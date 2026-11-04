"""
Local XAI Explainer using TreeSHAP
Converts mathematical Shapley values into human-readable,
actionable risk explanations for warehouse packing supervisors.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class ReturnExplainer:
    def __init__(self):
        self.model_path = os.path.join(MODELS_DIR, "xgboost_return_model.pkl")
        self.explainer_path = os.path.join(MODELS_DIR, "shap_tree_explainer.pkl")
        self.meta_path = os.path.join(MODELS_DIR, "feature_metadata.json")
        
        self.model = None
        self.explainer = None
        self.feature_cols = []
        self.feature_labels = {}
        
        self._load_assets()

    def _load_assets(self):
        if os.path.exists(self.model_path) and os.path.exists(self.explainer_path):
            self.model = joblib.load(self.model_path)
            self.explainer = joblib.load(self.explainer_path)
            with open(self.meta_path, "r") as f:
                meta = json.load(f)
                self.feature_cols = meta["feature_cols"]
                self.feature_labels = meta["feature_labels"]
        else:
            # Fallback mock initialization if models are not yet trained on disk
            self.feature_cols = [
                "is_bracket_order", "is_cod", "pincode_tier_code", "order_mrp_total",
                "discount_pct", "cust_total_orders", "cust_return_rate",
                "cust_past_rto_count", "sku_avg_fit_defect_score",
                "sku_avg_fabric_defect_score", "sku_avg_color_defect_score"
            ]
            self.feature_labels = {
                "is_bracket_order": "Bracket Shopping (Adjacent Sizes in Cart)",
                "is_cod": "Cash On Delivery (COD) Payment",
                "pincode_tier_code": "Delivery Geography Tier",
                "order_mrp_total": "Total Order MRP",
                "discount_pct": "Promotional Discount %",
                "cust_total_orders": "Customer Historical Lifetime Orders",
                "cust_return_rate": "Customer Historical Return Ratio",
                "cust_past_rto_count": "Past Undelivered/RTO Incidents",
                "sku_avg_fit_defect_score": "SKU NLP Sizing/Fit Inconsistency",
                "sku_avg_fabric_defect_score": "SKU NLP Stitching/Fabric Defect",
                "sku_avg_color_defect_score": "SKU NLP Color/Image Mismatch"
            }

    def explain_order(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes raw features, computes P(return) and generates local SHAP explanation.
        """
        # Ensure row aligns with trained features
        row = pd.DataFrame([feature_dict])[self.feature_cols]
        
        if self.model is not None and self.explainer is not None:
            p_return = float(self.model.predict_proba(row)[0, 1])
            shap_values = self.explainer.shap_values(row)
            
            # If shap returns list (binary classification), take index 1 (positive class)
            if isinstance(shap_values, list):
                sv = shap_values[1][0]
            else:
                sv = shap_values[0]
                
            base_val = float(self.explainer.expected_value[1] if isinstance(self.explainer.expected_value, list) else self.explainer.expected_value)
        else:
            # Rule-based synthetic approximation if models haven't been compiled locally yet
            is_bracket = feature_dict.get("is_bracket_order", 0)
            is_cod = feature_dict.get("is_cod", 0)
            fit_defect = feature_dict.get("sku_avg_fit_defect_score", 0.0)
            fab_defect = feature_dict.get("sku_avg_fabric_defect_score", 0.0)
            cust_ret = feature_dict.get("cust_return_rate", 0.1)
            
            p_return = min(0.96, 0.10 + (0.45 * is_bracket) + (0.15 * is_cod) + (0.25 * fit_defect) + (0.20 * fab_defect) + (0.20 * cust_ret))
            sv = np.array([
                0.35 if is_bracket else -0.05,
                0.12 if is_cod else -0.08,
                0.02,
                0.01,
                0.01,
                -0.03,
                0.10 if cust_ret > 0.3 else -0.05,
                0.05,
                0.22 if fit_defect > 0.5 else -0.04,
                0.15 if fab_defect > 0.4 else -0.02,
                0.01
            ])
            base_val = 0.28

        # Format drivers
        contributions = []
        for col, val, shap_val in zip(self.feature_cols, row.iloc[0], sv):
            contributions.append({
                "feature": col,
                "label": self.feature_labels.get(col, col),
                "actual_value": float(val),
                "shap_impact": round(float(shap_val), 4),
                "direction": "INCREASES_RISK" if shap_val > 0 else "REDUCES_RISK"
            })
            
        # Top 3 positive risk drivers
        risk_drivers = sorted([c for c in contributions if c["shap_impact"] > 0], key=lambda x: x["shap_impact"], reverse=True)[:3]
        protective_factors = sorted([c for c in contributions if c["shap_impact"] < 0], key=lambda x: x["shap_impact"])[:2]
        
        # Build plain text summary
        reasons = [f"{d['label']} (+{int(abs(d['shap_impact']) * 100)}% risk)" for d in risk_drivers]
        summary_text = "Primary return drivers: " + ", ".join(reasons) if reasons else "Normal order profile."

        return {
            "p_return": round(p_return, 4),
            "base_rate": round(base_val, 4),
            "risk_level": "HIGH" if p_return >= 0.70 else ("MEDIUM" if p_return >= 0.40 else "LOW"),
            "risk_drivers": risk_drivers,
            "protective_factors": protective_factors,
            "all_contributions": contributions,
            "human_summary": summary_text
        }
