"""
Pydantic Schemas for FastAPI Gateway & Decision Support System
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class CartItem(BaseModel):
    sku_id: str = Field(..., min_length=1, max_length=64)
    style_parent_id: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=64)
    size: str = Field(..., min_length=1, max_length=32)
    mrp: float = Field(..., ge=0, le=1_000_000)


class CheckoutPayload(BaseModel):
    order_id: str = Field(..., min_length=1, max_length=64)
    customer_id: str = Field(..., min_length=1, max_length=64)
    payment_mode: Literal["COD", "PREPAID"]
    pincode_tier: Literal["Tier_1", "Tier_2", "Tier_3"] = "Tier_2"
    discount_pct: float = Field(0.15, ge=0, le=0.9, description="Discount between 0.0 and 0.9")
    items: List[CartItem] = Field(..., min_length=1, max_length=100)


class WarehouseActionRequest(BaseModel):
    order_id: str = Field(..., min_length=1, max_length=64)
    action_taken: Literal[
        "QC_CHECK",
        "SIZE_CONFIRMATION",
        "PROTECTIVE_PACKAGING",
        "DISPATCH_AS_IS",
    ]
    # Ignored by the server; the authenticated operator identity is used instead.
    operator_id: Optional[str] = Field(default=None, max_length=64)


class CopilotQuery(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    context_order_id: Optional[str] = Field(default=None, max_length=64)
