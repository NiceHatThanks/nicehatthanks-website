#!/usr/bin/env python3
"""Small NiceHatThanks sandbox fulfilment tool.

Lists paid Stripe Checkout orders through the protected Cloudflare Worker API
and can mark one as dispatched, which sends the customer a dispatch email.

No Stripe or Resend keys are stored locally. Set NICEHATTHANKS_ADMIN_KEY or
enter the admin key when prompted.
"""

from __future__ import annotations

import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any

BASE_URL = os.environ.get("NICEHATTHANKS_API_URL", "https://nicehatthanks.com").rstrip("/")
ADMIN_KEY_ENV = "NICEHATTHANKS_ADMIN_KEY"


def api_request(path: str, admin_key: str, method: str = "GET", body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    headers = {
        "Authorization": f"Bearer {admin_key}",
        "Accept": "application/json",
        "User-Agent": "NiceHatThanksOrderTool/1.0",
    }

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode("utf-8"))
            message = payload.get("error") or str(payload)
        except Exception:
            message = f"HTTP {error.code}"
        raise RuntimeError(message) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Unable to reach {BASE_URL}: {error.reason}") from error


def money(pence: Any) -> str:
    try:
        return f"£{int(pence) / 100:.2f}"
    except (TypeError, ValueError):
        return "£0.00"


def created_text(timestamp: Any) -> str:
    try:
        return datetime.fromtimestamp(int(timestamp)).astimezone().strftime("%d %b %Y %H:%M")
    except (TypeError, ValueError, OSError):
        return "Unknown date"


def print_address(address: dict[str, Any] | None) -> None:
    if not address:
        print("    Address: not available")
        return

    parts = [
        address.get("line1"),
        address.get("line2"),
        address.get("city"),
        address.get("state"),
        address.get("postal_code"),
        address.get("country"),
    ]
    clean = [str(part) for part in parts if part]
    print("    Address: " + ", ".join(clean))


def print_item(item: dict[str, Any]) -> None:
    name = item.get("name") or item.get("product") or "Item"
    quantity = item.get("quantity", 1)
    configuration = item.get("configuration")
    print(f"      - {name} x{quantity}" + (f" ({configuration})" if configuration else ""))

    colours = item.get("colours") or {}
    if colours:
        print(
            "        "
            f"Lid: {colours.get('lid', '?')} | "
            f"Base: {colours.get('base', '?')} | "
            f"Left: {colours.get('leftButton', '?')} | "
            f"Right: {colours.get('rightButton', '?')}"
        )


def print_order(index: int, order: dict[str, Any]) -> None:
    customer = order.get("customer") or {}
    shipping = order.get("shipping") or {}
    fulfilment = order.get("fulfilment") or {}
    status = fulfilment.get("status") or "pending"

    print()
    print(f"[{index}] {created_text(order.get('created'))}  {money(order.get('amountTotal'))}  [{status.upper()}]")
    print(f"    {customer.get('name') or 'Unknown customer'} <{customer.get('email') or 'no email'}>")
    print(f"    Shipping: {shipping.get('service') or 'Unknown'} ({money(shipping.get('amount'))})")
    print_address(shipping.get("address"))
    print("    Order:")
    for item in order.get("items") or []:
        print_item(item)

    tracking = fulfilment.get("trackingNumber")
    if tracking:
        print(f"    Tracking: {tracking}")


def load_orders(admin_key: str) -> list[dict[str, Any]]:
    payload = api_request("/api/admin/orders", admin_key)
    return payload.get("orders") or []


def main() -> int:
    print("NiceHatThanks order tool - Stripe sandbox")
    print(f"API: {BASE_URL}")

    admin_key = os.environ.get(ADMIN_KEY_ENV)
    if not admin_key:
        admin_key = getpass.getpass("Admin key: ").strip()
    if not admin_key:
        print("No admin key supplied.")
        return 1

    try:
        orders = load_orders(admin_key)
    except RuntimeError as error:
        print(f"Error: {error}")
        return 1

    pending = [order for order in orders if (order.get("fulfilment") or {}).get("status", "pending") != "dispatched"]
    dispatched = [order for order in orders if (order.get("fulfilment") or {}).get("status") == "dispatched"]

    if not pending:
        print("\nNo paid orders are waiting to be dispatched.")
        if dispatched:
            print(f"{len(dispatched)} dispatched test order(s) are on Stripe.")
        return 0

    print(f"\n{len(pending)} paid order(s) waiting to be dispatched:")
    for index, order in enumerate(pending, start=1):
        print_order(index, order)

    print()
    choice = input("Order number to mark dispatched (Enter to exit): ").strip()
    if not choice:
        return 0

    try:
        selected_index = int(choice)
        if selected_index < 1 or selected_index > len(pending):
            raise ValueError
    except ValueError:
        print("Invalid order number.")
        return 1

    order = pending[selected_index - 1]
    shipping_service = ((order.get("shipping") or {}).get("service") or "")
    tracking_number = ""
    if "tracked" in shipping_service.lower():
        tracking_number = input("Royal Mail tracking number (Enter if not available): ").strip()

    customer = order.get("customer") or {}
    print()
    print(f"This will email {customer.get('email') or 'the customer'} and mark the order dispatched in Stripe.")
    confirm = input("Type YES to continue: ").strip()
    if confirm != "YES":
        print("Cancelled.")
        return 0

    try:
        result = api_request(
            "/api/admin/dispatch",
            admin_key,
            method="POST",
            body={
                "sessionId": order.get("id"),
                "trackingNumber": tracking_number,
            },
        )
    except RuntimeError as error:
        print(f"Error: {error}")
        return 1

    if result.get("alreadyDispatched"):
        print("Order was already marked as dispatched. No duplicate email was sent.")
    else:
        print("Done - dispatch email sent and order marked as dispatched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
