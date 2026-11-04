"""
Celery Background Tasks: Feature Synthesis, XGBoost Inference & TreeSHAP Attribution
"""

import sys
import os
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)

from src.api.celery_app import celery_app
from src.cost_engine.financial_matrix import evaluate_cost_matrix
from src.ml.shap_explainer import ReturnExplainer

# Explainer instance inside worker process
explainer = ReturnExplainer()

@celery_app.task(name="tasks.evaluate_order_risk")
def evaluate_order_risk_task(order_payload: dict) -> dict:
    """
    Background Celery worker task:
    1. Extracts cart anomaly features (bracket shopping check)
    2. Runs XGBoost predictive return model
    3. Computes TreeSHAP local attributions
    4. Evaluates Unit Economics (baseline loss vs mitigation ROI)
    5. Returns packing station dispatch directive
    """
    items = order_payload.get("items", [])
    styles = [it.get("style_parent_id") for it in items]
    is_bracket = len(styles) > len(set(styles))
    
    is_cod = 1 if order_payload.get("payment_mode") == "COD" else 0
    pincode_tier = order_payload.get("pincode_tier", "Tier_2")
    tier_code = 1 if pincode_tier == "Tier_1" else (2 if pincode_tier == "Tier_2" else 3)
    total_mrp = sum([it.get("mrp", 0.0) for it in items])
    discount_pct = float(order_payload.get("discount_pct", 0.15))
    final_order_value = total_mrp * (1.0 - discount_pct)
    
    feature_dict = {
        "is_bracket_order": 1 if is_bracket else 0,
        "is_cod": is_cod,
        "pincode_tier_code": tier_code,
        "order_mrp_total": total_mrp,
        "discount_pct": discount_pct,
        "cust_total_orders": 6,
        "cust_return_rate": 0.28,
        "cust_past_rto_count": 1,
        "sku_avg_fit_defect_score": 0.65 if is_bracket else 0.15,
        "sku_avg_fabric_defect_score": 0.12,
        "sku_avg_color_defect_score": 0.04
    }
    
    # 1. XGBoost & TreeSHAP local attribution
    xai_res = explainer.explain_order(feature_dict)
    
    # 2. Cost-Loss Unit Economics Evaluation
    cost_res = evaluate_cost_matrix(
        p_return=xai_res["p_return"],
        is_bracket=is_bracket,
        sku_fit_defect=feature_dict["sku_avg_fit_defect_score"],
        sku_fabric_defect=feature_dict["sku_avg_fabric_defect_score"],
        order_mrp=final_order_value
    )
    
    return {
        "order_id": order_payload.get("order_id"),
        "customer_id": order_payload.get("customer_id"),
        "processed_at": datetime.utcnow().isoformat(),
        "is_bracket_order": is_bracket,
        "risk_level": xai_res["risk_level"],
        "p_return": xai_res["p_return"],
        "top_shap_drivers": xai_res["top_reasons"],
        "baseline_expected_loss_inr": cost_res["baseline_expected_loss_inr"],
        "recommended_action": cost_res["recommended_action"],
        "action_cost_inr": cost_res["action_cost_inr"],
        "net_projected_savings_inr": cost_res["net_projected_savings_inr"],
        "status": "DISPATCH_DIRECTIVE_READY"
    }
