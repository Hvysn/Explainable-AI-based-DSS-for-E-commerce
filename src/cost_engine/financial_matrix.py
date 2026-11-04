"""
Financial Loss & Cost-Aware Mitigation Engine
Implements the Core Mathematical Decision Logic:
- Expected Loss = P(return) * ₹400 (Baseline Reverse Logistics Sunk Cost)
- Expected Net Savings = (Delta P * ₹400) - C(intervention)
Selects the optimal physical/digital intervention that maximizes positive ROI.
"""

from typing import Dict, Any, List

# Industry Standard Baseline Costs (in INR)
BASELINE_RETURN_COST_INR = 400.00  # Two-way freight, restock, inspection, bagging

INTERVENTIONS = {
    "SIZE_CONFIRMATION_PROMPT": {
        "name": "Automated WhatsApp Size-Verification",
        "type": "DIGITAL",
        "cost_inr": 5.00,
        "efficiency_factor": 0.55,  # Resolves 55% of bracket/size discrepancy returns
        "primary_trigger": "bracket_or_size"
    },
    "PHYSICAL_QC_CHECK": {
        "name": "Targeted Pre-Shipment QC Inspection",
        "type": "PHYSICAL_WAREHOUSE",
        "cost_inr": 35.00,
        "efficiency_factor": 0.65,  # Catches 65% of stitching/zipper/fabric defects
        "primary_trigger": "fabric_or_quality"
    },
    "REINFORCED_PROTECTIVE_PACKAGING": {
        "name": "Deploy Reusable Protective Sleeve",
        "type": "PHYSICAL_WAREHOUSE",
        "cost_inr": 20.00,
        "efficiency_factor": 0.40,  # Prevents transit tears & damage
        "primary_trigger": "transit_damage"
    },
    "DISPATCH_AS_IS": {
        "name": "Direct Dispatch (No Intervention)",
        "type": "NONE",
        "cost_inr": 0.00,
        "efficiency_factor": 0.00,
        "primary_trigger": "low_risk"
    }
}


def evaluate_cost_matrix(
    p_return: float,
    is_bracket: bool,
    sku_fit_defect: float,
    sku_fabric_defect: float,
    order_mrp: float = 1500.0
) -> Dict[str, Any]:
    """
    Computes expected baseline loss and evaluates all intervention options
    to recommend the action with maximum net operational savings.
    """
    baseline_expected_loss = round(p_return * BASELINE_RETURN_COST_INR, 2)
    
    # If the return risk is minimal (< 20%), no intervention is economically justified
    if p_return < 0.20:
        return {
            "p_return_original": round(p_return, 4),
            "baseline_expected_loss_inr": baseline_expected_loss,
            "recommended_action": INTERVENTIONS["DISPATCH_AS_IS"]["name"],
            "intervention_cost_inr": 0.0,
            "p_return_post_intervention": round(p_return, 4),
            "expected_loss_post_intervention_inr": baseline_expected_loss,
            "projected_net_savings_inr": 0.0,
            "roi_ratio": 0.0,
            "action_urgency": "LOW",
            "justification": "Return probability is within acceptable commercial threshold (<= 20%)."
        }

    evaluated_options = []
    
    # Evaluate Option 1: WhatsApp Size Confirmation Prompt (₹5)
    if is_bracket or sku_fit_defect > 0.40:
        delta_p = p_return * INTERVENTIONS["SIZE_CONFIRMATION_PROMPT"]["efficiency_factor"]
        p_post = p_return - delta_p
        cost = INTERVENTIONS["SIZE_CONFIRMATION_PROMPT"]["cost_inr"]
        loss_saved = delta_p * BASELINE_RETURN_COST_INR
        net_savings = loss_saved - cost
        evaluated_options.append({
            "key": "SIZE_CONFIRMATION_PROMPT",
            "delta_p": delta_p,
            "p_post": p_post,
            "cost": cost,
            "net_savings": net_savings,
            "priority_score": net_savings * 1.2  # high preference for non-disruptive digital prompt
        })

    # Evaluate Option 2: Physical QC Check (₹35)
    if sku_fabric_defect > 0.30 or (not is_bracket and p_return > 0.50):
        delta_p = p_return * INTERVENTIONS["PHYSICAL_QC_CHECK"]["efficiency_factor"]
        p_post = p_return - delta_p
        cost = INTERVENTIONS["PHYSICAL_QC_CHECK"]["cost_inr"]
        loss_saved = delta_p * BASELINE_RETURN_COST_INR
        net_savings = loss_saved - cost
        evaluated_options.append({
            "key": "PHYSICAL_QC_CHECK",
            "delta_p": delta_p,
            "p_post": p_post,
            "cost": cost,
            "net_savings": net_savings,
            "priority_score": net_savings
        })

    # Evaluate Option 3: Protective Packaging (₹20)
    if order_mrp >= 2000 and not is_bracket:
        delta_p = p_return * INTERVENTIONS["REINFORCED_PROTECTIVE_PACKAGING"]["efficiency_factor"]
        p_post = p_return - delta_p
        cost = INTERVENTIONS["REINFORCED_PROTECTIVE_PACKAGING"]["cost_inr"]
        loss_saved = delta_p * BASELINE_RETURN_COST_INR
        net_savings = loss_saved - cost
        evaluated_options.append({
            "key": "REINFORCED_PROTECTIVE_PACKAGING",
            "delta_p": delta_p,
            "p_post": p_post,
            "cost": cost,
            "net_savings": net_savings,
            "priority_score": net_savings * 0.9
        })

    # Pick the option yielding highest net positive savings
    valid_options = [opt for opt in evaluated_options if opt["net_savings"] > 0]
    
    if not valid_options:
        return {
            "p_return_original": round(p_return, 4),
            "baseline_expected_loss_inr": baseline_expected_loss,
            "recommended_action": INTERVENTIONS["DISPATCH_AS_IS"]["name"],
            "intervention_cost_inr": 0.0,
            "p_return_post_intervention": round(p_return, 4),
            "expected_loss_post_intervention_inr": baseline_expected_loss,
            "projected_net_savings_inr": 0.0,
            "roi_ratio": 0.0,
            "action_urgency": "LOW",
            "justification": "Intervention costs exceed projected recovery benefit."
        }

    # Sort by priority score
    best = sorted(valid_options, key=lambda x: x["priority_score"], reverse=True)[0]
    meta = INTERVENTIONS[best["key"]]
    
    roi = round((best["net_savings"] / best["cost"]), 2) if best["cost"] > 0 else 0.0
    urgency = "HIGH" if p_return >= 0.70 else "MEDIUM"
    
    return {
        "p_return_original": round(p_return, 4),
        "baseline_expected_loss_inr": baseline_expected_loss,
        "recommended_action": meta["name"],
        "intervention_type": meta["type"],
        "intervention_cost_inr": meta["cost_inr"],
        "p_return_post_intervention": round(best["p_post"], 4),
        "expected_loss_post_intervention_inr": round(best["p_post"] * BASELINE_RETURN_COST_INR, 2),
        "projected_net_savings_inr": round(best["net_savings"], 2),
        "roi_ratio": roi,
        "action_urgency": urgency,
        "justification": f"Reduces return risk by {int(best['delta_p'] * 100)}% with ₹{round(best['net_savings'], 2)} net positive recovery."
    }


if __name__ == "__main__":
    # Test Scenario: Bracket Shopping Order
    print("Testing Cost Engine with Bracket Order:")
    res = evaluate_cost_matrix(
        p_return=0.88,
        is_bracket=True,
        sku_fit_defect=0.75,
        sku_fabric_defect=0.10,
        order_mrp=2599
    )
    for k, v in res.items():
        print(f"  {k}: {v}")
