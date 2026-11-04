"""
XGBoost Classifier & TreeSHAP Training Pipeline
Trains the core return-prediction model on corporate e-commerce order features.
Evaluates ROC-AUC, Precision, Recall, and serializes the model + explainer.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report, accuracy_score
import xgboost as xgb
import shap

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(BASE_DIR, "data", "order_transactions.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLS = [
    "is_bracket_order",
    "is_cod",
    "pincode_tier_code",
    "order_mrp_total",
    "discount_pct",
    "cust_total_orders",
    "cust_return_rate",
    "cust_past_rto_count",
    "sku_avg_fit_defect_score",
    "sku_avg_fabric_defect_score",
    "sku_avg_color_defect_score"
]

FEATURE_LABELS = {
    "is_bracket_order": "Bracket Size Shopping (Multiple Sizes)",
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


def preprocess_data(df: pd.DataFrame):
    """Encodes categorical and numerical features."""
    df_clean = df.copy()
    df_clean["is_cod"] = (df_clean["payment_mode"] == "COD").astype(int)
    
    tier_map = {"Tier_1": 1, "Tier_2": 2, "Tier_3": 3}
    df_clean["pincode_tier_code"] = df_clean["pincode_tier"].map(tier_map).fillna(2).astype(int)
    
    X = df_clean[FEATURE_COLS]
    y = df_clean["is_returned"]
    return X, y


def train():
    print(f"Loading data from: {DATA_FILE}")
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(f"Missing {DATA_FILE}. Run generate_dataset.py first.")
        
    df = pd.read_csv(DATA_FILE)
    print(f"Loaded {len(df)} records. Class balance: {df['is_returned'].value_counts().to_dict()}")
    
    X, y = preprocess_data(df)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    # XGBoost Classifier with tuned hyperparameters for tabular retail data
    model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="logloss",
        random_state=42
    )
    
    print("Training XGBoost Classifier...")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)
    
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    acc = accuracy_score(y_test, y_pred)
    
    print(f"\n--- MODEL EVALUATION METRICS ---")
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    print(f"Accuracy:      {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Retained", "Returned"]))
    
    # TreeSHAP Explainer
    print("Fitting TreeSHAP explainer...")
    explainer = shap.TreeExplainer(model)
    
    # Save artifacts
    model_path = os.path.join(MODELS_DIR, "xgboost_return_model.pkl")
    explainer_path = os.path.join(MODELS_DIR, "shap_tree_explainer.pkl")
    meta_path = os.path.join(MODELS_DIR, "feature_metadata.json")
    
    joblib.dump(model, model_path)
    joblib.dump(explainer, explainer_path)
    
    with open(meta_path, "w") as f:
        json.dump({
            "feature_cols": FEATURE_COLS,
            "feature_labels": FEATURE_LABELS,
            "roc_auc": round(float(roc_auc), 4),
            "accuracy": round(float(acc), 4)
        }, f, indent=2)
        
    print(f" Model saved: {model_path}")
    print(f" SHAP Explainer saved: {explainer_path}")
    print(f" Metadata saved: {meta_path}")


if __name__ == "__main__":
    train()
