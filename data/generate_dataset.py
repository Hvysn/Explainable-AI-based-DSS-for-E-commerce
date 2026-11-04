"""
Corporate E-Commerce Dataset Generator for Reverse Logistics DSS
Simulates realistic Indian retail behavior:
- Bracket Shopping: Customers ordering multiple adjacent sizes (M, L) with intent to return one.
- Payment Mode Bias: Cash on Delivery (COD) showing ~2.5x higher RTO (Return to Origin) vs Prepaid.
- Regional Logistics Friction: Tier-1, Tier-2, and Tier-3 pincodes with varying return risks.
- NLP Review Aspects: Sizing discrepancies, fabric quality, and color mismatch.
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Fix random seed for reproducibility
np.random.seed(42)
random.seed(42)

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# -------------------------------------------------------------
# 1. GENERATE SKU CATALOG (50 Apparel Styles)
# -------------------------------------------------------------
CATEGORIES = [
    ("Women Ethnic", "Kurti", 799, 2499),
    ("Women Ethnic", "Anarkali Suit", 1499, 4999),
    ("Women Western", "Midi Dress", 899, 2999),
    ("Women Western", "High-Rise Jeans", 1199, 3499),
    ("Men Western", "Slim Fit Cotton Shirt", 699, 2199),
    ("Men Western", "Chinos", 999, 2799),
    ("Men Western", "Oversized Graphic Tee", 499, 1499),
    ("Men Western", "Denim Jacket", 1599, 4599),
]

SIZES_MAP = {
    "Tops": ["XS", "S", "M", "L", "XL", "XXL"],
    "Bottoms": ["28", "30", "32", "34", "36", "38"]
}

skus = []
sku_counter = 1000

for cat, subcat, min_p, max_p in CATEGORIES:
    for i in range(1, 7):
        style_id = f"STY_{cat[:3].upper()}_{subcat[:3].upper()}_{i:02d}"
        size_type = "Bottoms" if ("Jeans" in subcat or "Chinos" in subcat) else "Tops"
        available_sizes = SIZES_MAP[size_type]
        
        # Inherent defect / sizing inconsistency tendency for this product
        # ~20% of products have notorious sizing issues (runs small/large)
        has_fit_issue = random.random() < 0.25
        has_fabric_flaw = random.random() < 0.15
        
        fit_defect_bias = round(random.uniform(0.55, 0.88), 2) if has_fit_issue else round(random.uniform(0.05, 0.25), 2)
        fabric_defect_bias = round(random.uniform(0.50, 0.85), 2) if has_fabric_flaw else round(random.uniform(0.02, 0.20), 2)
        color_accuracy_bias = round(random.uniform(0.05, 0.25), 2)
        
        base_price = round(random.uniform(min_p, max_p) / 50) * 50
        
        for sz in available_sizes:
            skus.append({
                "sku_id": f"SKU_{sku_counter}",
                "style_parent_id": style_id,
                "category": cat,
                "subcategory": subcat,
                "size": sz,
                "size_type": size_type,
                "mrp": base_price,
                "inherent_fit_defect_prob": fit_defect_bias,
                "inherent_fabric_defect_prob": fabric_defect_bias,
                "inherent_color_mismatch_prob": color_accuracy_bias,
            })
            sku_counter += 1

df_skus = pd.DataFrame(skus)
sku_file = os.path.join(OUTPUT_DIR, "sku_catalog.csv")
df_skus.to_csv(sku_file, index=False)
print(f" Saved {len(df_skus)} SKUs to {sku_file}")

# -------------------------------------------------------------
# 2. GENERATE UNSTRUCTURED REVIEWS FOR NLP DISTILBERT
# -------------------------------------------------------------
FIT_REVIEWS_NEGATIVE = [
    "Runs way too small! Ordered M but feels like XS. Will have to return.",
    "The shoulder fit is extremely tight, arms are uncomfortably stitched.",
    "Ordered two sizes because sizing is so inconsistent. Keeping neither.",
    "Very tight across the chest, please order one size up if buying.",
    "Waist measurement does not match the size chart at all. Returning it."
]
FABRIC_REVIEWS_NEGATIVE = [
    "Stitching came loose after one wear. Cheap thread quality.",
    "Zipper got stuck on first zip. Defective piece received.",
    "Material feels like rough synthetic polyester, not pure cotton as advertised.",
    "Buttons fell off right out of the plastic package.",
    "Transparent thin cloth, see-through in daylight. Very poor quality."
]
REVIEWS_POSITIVE = [
    "Perfect fit and premium fabric! Looks even better in person.",
    "True to size, comfortable cotton cloth and neat stitching.",
    "Value for money purchase, fast delivery and great packing.",
    "Loved the color and cut, fits like a glove.",
    "Excellent quality product, highly recommended!"
]

reviews_data = []
review_id_counter = 50000

for _, row in df_skus.drop_duplicates(subset=["style_parent_id"]).iterrows():
    style_id = row["style_parent_id"]
    fit_bias = row["inherent_fit_defect_prob"]
    fab_bias = row["inherent_fabric_defect_prob"]
    
    # 10 to 20 reviews per style
    num_revs = random.randint(10, 20)
    for _ in range(num_revs):
        r_type = random.random()
        if r_type < fit_bias:
            text = random.choice(FIT_REVIEWS_NEGATIVE)
            rating = random.choice([1, 2])
            aspect = "size_fit_mismatch"
        elif r_type < (fit_bias + fab_bias):
            text = random.choice(FABRIC_REVIEWS_NEGATIVE)
            rating = random.choice([1, 2])
            aspect = "fabric_quality"
        else:
            text = random.choice(REVIEWS_POSITIVE)
            rating = random.choice([4, 5])
            aspect = "positive"
            
        reviews_data.append({
            "review_id": f"REV_{review_id_counter}",
            "style_parent_id": style_id,
            "category": row["category"],
            "rating": rating,
            "review_text": text,
            "ground_truth_aspect": aspect
        })
        review_id_counter += 1

df_reviews = pd.DataFrame(reviews_data)
reviews_file = os.path.join(OUTPUT_DIR, "raw_reviews.csv")
df_reviews.to_csv(reviews_file, index=False)
print(f" Saved {len(df_reviews)} Customer Reviews to {reviews_file}")

# -------------------------------------------------------------
# 3. GENERATE CUSTOMER PROFILES (2,000 Customers)
# -------------------------------------------------------------
customers = []
for cid in range(1001, 3001):
    cust_id = f"CUST_{cid}"
    total_orders = max(1, int(np.random.exponential(scale=6)))
    
    # Customer return habit: 70% low returners, 20% moderate, 10% habitual returners
    tier = random.choices(["low", "med", "high"], weights=[0.70, 0.20, 0.10])[0]
    if tier == "low":
        return_rate = round(random.uniform(0.02, 0.15), 2)
    elif tier == "med":
        return_rate = round(random.uniform(0.18, 0.35), 2)
    else:
        return_rate = round(random.uniform(0.40, 0.75), 2)
        
    rto_count = int(total_orders * return_rate * random.uniform(0.3, 0.8))
    account_age_days = random.randint(30, 1200)
    
    customers.append({
        "customer_id": cust_id,
        "total_historical_orders": total_orders,
        "historical_return_rate": return_rate,
        "past_rto_count": rto_count,
        "account_age_days": account_age_days,
        "is_habitual_returner": 1 if tier == "high" else 0
    })

df_customers = pd.DataFrame(customers)

# -------------------------------------------------------------
# 4. GENERATE 6,000 REALISTIC ORDERS WITH BRACKET SHOPPING
# -------------------------------------------------------------
orders = []
start_date = datetime(2026, 8, 1)

for oid in range(10001, 16001):
    order_id = f"ORD_{oid}"
    cust = df_customers.sample(1).iloc[0]
    order_time = start_date + timedelta(
        days=random.randint(0, 90),
        hours=random.randint(8, 23),
        minutes=random.randint(0, 59)
    )
    
    # Tier distribution: Tier 1 (40%), Tier 2 (35%), Tier 3 (25%)
    pincode_tier = random.choices(["Tier_1", "Tier_2", "Tier_3"], weights=[0.40, 0.35, 0.25])[0]
    
    # Payment Method: COD vs Prepaid
    # Tier-2/3 have higher COD ratio
    cod_prob = 0.30 if pincode_tier == "Tier_1" else (0.55 if pincode_tier == "Tier_2" else 0.75)
    payment_mode = "COD" if random.random() < cod_prob else "PREPAID"
    
    # Bracket Shopping Decision: ~18% of apparel orders exhibit bracket shopping
    is_bracket = random.random() < 0.18
    
    items = []
    if is_bracket:
        # Pick 1 random style, pick 2 adjacent sizes (e.g. M and L or 30 and 32)
        sample_sku = df_skus.sample(1).iloc[0]
        style = sample_sku["style_parent_id"]
        avail = df_skus[df_skus["style_parent_id"] == style].copy().reset_index(drop=True)
        
        if len(avail) >= 2:
            # Pick 2 adjacent sizes
            idx = random.randint(0, len(avail) - 2)
            item1 = avail.iloc[idx]
            item2 = avail.iloc[idx + 1]
            items.extend([item1, item2])
        else:
            items.append(sample_sku)
            is_bracket = False
    else:
        # Standard cart: 1 to 3 random items
        num_items = random.choices([1, 2, 3], weights=[0.65, 0.25, 0.10])[0]
        selected = df_skus.sample(num_items)
        for _, itm in selected.iterrows():
            items.append(itm)
            
    # Calculate cart financial metrics
    cart_items_count = len(items)
    cart_total_mrp = sum([it["mrp"] for it in items])
    discount_pct = random.choice([0.10, 0.15, 0.20, 0.30, 0.40])
    final_order_value = round(cart_total_mrp * (1 - discount_pct))
    
    # Average SKU Defect Vector for items in this cart
    avg_sku_fit_defect = np.mean([it["inherent_fit_defect_prob"] for it in items])
    avg_sku_fabric_defect = np.mean([it["inherent_fabric_defect_prob"] for it in items])
    avg_sku_color_defect = np.mean([it["inherent_color_mismatch_prob"] for it in items])
    
    # ---------------------------------------------------------
    # GROUND TRUTH RETURN DETERMINATION (Corporate Realistic Equation)
    # ---------------------------------------------------------
    # Latent return propensity
    # 1. Bracket shopping almost GUARANTEES at least 1 item returned (+0.55)
    # 2. High customer return history (+0.35)
    # 3. COD orders (+0.18)
    # 4. Sizing defect on SKU (+0.25)
    # 5. Fabric defect on SKU (+0.15)
    # 6. Tier-3 COD (+0.10)
    
    latent_risk = (
        0.08  # Baseline e-commerce organic return rate
        + (0.55 if is_bracket else 0.0)
        + (0.35 * cust["historical_return_rate"])
        + (0.18 if payment_mode == "COD" else -0.05)
        + (0.28 * avg_sku_fit_defect)
        + (0.16 * avg_sku_fabric_defect)
        + (0.12 if pincode_tier == "Tier_3" and payment_mode == "COD" else 0.0)
    )
    
    # Add random noise
    latent_risk += np.random.normal(0, 0.05)
    p_true = 1 / (1 + np.exp(-10 * (latent_risk - 0.45)))  # Sigmoidal mapping
    p_true = min(max(p_true, 0.02), 0.98)
    
    is_returned = 1 if (random.random() < p_true) else 0
    
    # SKU IDs string
    item_skus_str = "|".join([it["sku_id"] for it in items])
    item_styles_str = "|".join([it["style_parent_id"] for it in items])
    
    orders.append({
        "order_id": order_id,
        "customer_id": cust["customer_id"],
        "order_timestamp": order_time.strftime("%Y-%m-%d %H:%M:%S"),
        "cart_items_count": cart_items_count,
        "is_bracket_order": 1 if is_bracket else 0,
        "payment_mode": payment_mode,
        "pincode_tier": pincode_tier,
        "order_mrp_total": cart_total_mrp,
        "discount_pct": discount_pct,
        "final_order_value": final_order_value,
        # Customer historical features
        "cust_total_orders": cust["total_historical_orders"],
        "cust_return_rate": cust["historical_return_rate"],
        "cust_past_rto_count": cust["past_rto_count"],
        "cust_account_age_days": cust["account_age_days"],
        # Pre-computed SKU Aspect features
        "sku_avg_fit_defect_score": round(avg_sku_fit_defect, 3),
        "sku_avg_fabric_defect_score": round(avg_sku_fabric_defect, 3),
        "sku_avg_color_defect_score": round(avg_sku_color_defect, 3),
        # Ordered items info
        "item_skus": item_skus_str,
        "item_styles": item_styles_str,
        # Ground Truth Label
        "is_returned": is_returned,
        "true_latent_probability": round(p_true, 4)
    })

df_orders = pd.DataFrame(orders)
orders_file = os.path.join(OUTPUT_DIR, "order_transactions.csv")
df_orders.to_csv(orders_file, index=False)
print(f" Saved {len(df_orders)} Orders to {orders_file}")

# Quick summary statistics
return_rate_overall = df_orders["is_returned"].mean() * 100
bracket_return_rate = df_orders[df_orders["is_bracket_order"] == 1]["is_returned"].mean() * 100
cod_return_rate = df_orders[df_orders["payment_mode"] == "COD"]["is_returned"].mean() * 100
prepaid_return_rate = df_orders[df_orders["payment_mode"] == "PREPAID"]["is_returned"].mean() * 100

print("\n--- Corporate Dataset Summary ---")
print(f"Total Transactions: {len(df_orders):,}")
print(f"Overall Return Rate: {return_rate_overall:.1f}%")
print(f"Bracket Shopping Orders Return Rate: {bracket_return_rate:.1f}% (High-risk bracket behavior)")
print(f"COD Return Rate: {cod_return_rate:.1f}% vs Prepaid: {prepaid_return_rate:.1f}%")
print("---------------------------------")
