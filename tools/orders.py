#!/usr/bin/env python3
"""NiceHatThanks sandbox fulfilment desktop app.

The app talks to the protected Cloudflare Worker admin API. Stripe and Resend
credentials stay in Cloudflare; locally, only NICEHATTHANKS_ADMIN_KEY is used.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any

try:
    from PySide6.QtCore import Qt
    from PySide6.QtGui import QGuiApplication
    from PySide6.QtWidgets import (
        QApplication,
        QComboBox,
        QFrame,
        QHBoxLayout,
        QHeaderView,
        QInputDialog,
        QLabel,
        QLineEdit,
        QListWidget,
        QListWidgetItem,
        QMainWindow,
        QMessageBox,
        QPushButton,
        QScrollArea,
        QSplitter,
        QTableWidget,
        QTableWidgetItem,
        QVBoxLayout,
        QWidget,
    )
except ImportError:
    print("PySide6 is required for the NiceHatThanks order tool.")
    print("Install it with: python -m pip install PySide6")
    raise SystemExit(1)


BASE_URL = os.environ.get("NICEHATTHANKS_API_URL", "https://nicehatthanks.com").rstrip("/")
ADMIN_KEY_ENV = "NICEHATTHANKS_ADMIN_KEY"

APP_STYLESHEET = """
QWidget {
    background: #F5F0E6;
    color: #1C211B;
    font-family: "Segoe UI";
    font-size: 10pt;
}
QMainWindow {
    background: #F5F0E6;
}
QFrame#headerFrame, QFrame#panelFrame, QFrame#summaryFrame {
    background: #FFFDF8;
    border: 1px solid #D8D1C5;
    border-radius: 12px;
}
QLabel#titleLabel {
    font-size: 22pt;
    font-weight: 800;
}
QLabel#subtitleLabel, QLabel#mutedLabel {
    color: #666862;
}
QLabel#sectionLabel {
    font-size: 12pt;
    font-weight: 700;
}
QLabel#statusPending {
    background: #F4D7E2;
    border: 1px solid #E496B3;
    border-radius: 9px;
    padding: 4px 9px;
    font-weight: 700;
}
QLabel#statusDispatched {
    background: #DCECF6;
    border: 1px solid #B6D6EB;
    border-radius: 9px;
    padding: 4px 9px;
    font-weight: 700;
}
QPushButton {
    background: #1C211B;
    color: #F5F0E6;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-weight: 700;
}
QPushButton:hover {
    background: #30372D;
}
QPushButton:disabled {
    background: #B8B4AC;
    color: #EEEAE2;
}
QPushButton#secondaryButton {
    background: #FFFDF8;
    color: #1C211B;
    border: 1px solid #B8B2A8;
}
QPushButton#secondaryButton:hover {
    background: #ECE6DA;
}
QListWidget, QTableWidget, QLineEdit, QComboBox {
    background: #FFFDF8;
    border: 1px solid #CFC8BC;
    border-radius: 8px;
    selection-background-color: #B6D6EB;
    selection-color: #1C211B;
}
QListWidget {
    padding: 5px;
}
QListWidget::item {
    border-radius: 7px;
    padding: 10px 8px;
    margin: 2px 0;
}
QListWidget::item:selected {
    background: #B6D6EB;
}
QLineEdit, QComboBox {
    padding: 7px;
}
QHeaderView::section {
    background: #EAE4D8;
    color: #1C211B;
    border: none;
    border-bottom: 1px solid #CFC8BC;
    padding: 7px;
    font-weight: 700;
}
QTableWidget {
    gridline-color: #DED8CC;
}
QScrollArea {
    border: none;
}
"""


def api_request(
    path: str,
    admin_key: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = None
    headers = {
        "Authorization": f"Bearer {admin_key}",
        "Accept": "application/json",
        "User-Agent": "NiceHatThanksOrderTool/2.0",
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
        return datetime.fromtimestamp(int(timestamp)).astimezone().strftime("%d %b %Y  %H:%M")
    except (TypeError, ValueError, OSError):
        return "Unknown date"


def address_text(address: dict[str, Any] | None, multiline: bool = True) -> str:
    if not address:
        return "Address not available"

    parts = [
        address.get("line1"),
        address.get("line2"),
        address.get("city"),
        address.get("state"),
        address.get("postal_code"),
        address.get("country"),
    ]
    clean = [str(part) for part in parts if part]
    return ("\n" if multiline else ", ").join(clean) or "Address not available"


class OrderWindow(QMainWindow):
    def __init__(self, admin_key: str):
        super().__init__()
        self.admin_key = admin_key
        self.orders: list[dict[str, Any]] = []
        self.visible_orders: list[dict[str, Any]] = []
        self.current_order: dict[str, Any] | None = None

        self.setWindowTitle("NiceHatThanks Orders")
        self.resize(1260, 780)
        self.setMinimumSize(980, 650)
        self._build_ui()
        self.refresh_orders()

    def _build_ui(self) -> None:
        root = QWidget()
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(18, 18, 18, 18)
        root_layout.setSpacing(14)

        header = QFrame()
        header.setObjectName("headerFrame")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(18, 14, 18, 14)

        title_box = QVBoxLayout()
        title = QLabel("NiceHatThanks Orders")
        title.setObjectName("titleLabel")
        subtitle = QLabel("Stripe sandbox fulfilment")
        subtitle.setObjectName("subtitleLabel")
        title_box.addWidget(title)
        title_box.addWidget(subtitle)
        header_layout.addLayout(title_box)
        header_layout.addStretch()

        self.count_label = QLabel("Loading...")
        self.count_label.setObjectName("mutedLabel")
        header_layout.addWidget(self.count_label)

        self.refresh_button = QPushButton("Refresh")
        self.refresh_button.setObjectName("secondaryButton")
        self.refresh_button.clicked.connect(self.refresh_orders)
        header_layout.addWidget(self.refresh_button)
        root_layout.addWidget(header)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setChildrenCollapsible(False)

        left_panel = QFrame()
        left_panel.setObjectName("panelFrame")
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(14, 14, 14, 14)
        left_layout.setSpacing(10)

        filter_row = QHBoxLayout()
        filter_label = QLabel("Orders")
        filter_label.setObjectName("sectionLabel")
        filter_row.addWidget(filter_label)
        filter_row.addStretch()
        self.filter_combo = QComboBox()
        self.filter_combo.addItems(["Pending", "All", "Dispatched"])
        self.filter_combo.currentTextChanged.connect(self.apply_filter)
        filter_row.addWidget(self.filter_combo)
        left_layout.addLayout(filter_row)

        self.order_list = QListWidget()
        self.order_list.currentRowChanged.connect(self.order_selected)
        left_layout.addWidget(self.order_list, 1)
        splitter.addWidget(left_panel)

        right_panel = QFrame()
        right_panel.setObjectName("panelFrame")
        right_outer = QVBoxLayout(right_panel)
        right_outer.setContentsMargins(0, 0, 0, 0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        self.detail_layout = QVBoxLayout(scroll_content)
        self.detail_layout.setContentsMargins(20, 18, 20, 20)
        self.detail_layout.setSpacing(14)
        scroll.setWidget(scroll_content)
        right_outer.addWidget(scroll)
        splitter.addWidget(right_panel)

        splitter.setSizes([330, 900])
        root_layout.addWidget(splitter, 1)
        self.setCentralWidget(root)
        self.show_empty_details("Select an order to view its details.")

    def set_busy(self, busy: bool, message: str = "") -> None:
        self.refresh_button.setDisabled(busy)
        self.setCursor(Qt.CursorShape.WaitCursor if busy else Qt.CursorShape.ArrowCursor)
        if message:
            self.statusBar().showMessage(message)
        QApplication.processEvents()

    def refresh_orders(self) -> None:
        self.set_busy(True, "Loading paid Stripe orders...")
        try:
            payload = api_request("/api/admin/orders", self.admin_key)
            self.orders = payload.get("orders") or []
        except RuntimeError as error:
            QMessageBox.critical(self, "Unable to load orders", str(error))
            self.statusBar().showMessage("Unable to load orders")
            return
        finally:
            self.set_busy(False)

        self.apply_filter()
        self.statusBar().showMessage(f"Loaded {len(self.orders)} paid sandbox order(s)", 5000)

    def apply_filter(self) -> None:
        mode = self.filter_combo.currentText().lower()
        if mode == "pending":
            self.visible_orders = [order for order in self.orders if self.order_status(order) != "dispatched"]
        elif mode == "dispatched":
            self.visible_orders = [order for order in self.orders if self.order_status(order) == "dispatched"]
        else:
            self.visible_orders = list(self.orders)

        pending_count = sum(1 for order in self.orders if self.order_status(order) != "dispatched")
        self.count_label.setText(f"{pending_count} waiting  •  {len(self.orders)} paid")

        self.order_list.clear()
        for order in self.visible_orders:
            customer = order.get("customer") or {}
            status = self.order_status(order).upper()
            text = (
                f"{customer.get('name') or 'Unknown customer'}\n"
                f"{created_text(order.get('created'))}   {money(order.get('amountTotal'))}\n"
                f"{status}"
            )
            item = QListWidgetItem(text)
            item.setData(Qt.ItemDataRole.UserRole, order.get("id"))
            item.setSizeHint(item.sizeHint().expandedTo(self.order_list.sizeHint()))
            self.order_list.addItem(item)

        if self.visible_orders:
            self.order_list.setCurrentRow(0)
        else:
            self.current_order = None
            self.show_empty_details(f"No {mode} orders.")

    @staticmethod
    def order_status(order: dict[str, Any]) -> str:
        return ((order.get("fulfilment") or {}).get("status") or "pending").lower()

    def order_selected(self, row: int) -> None:
        if row < 0 or row >= len(self.visible_orders):
            self.current_order = None
            self.show_empty_details("Select an order to view its details.")
            return
        self.current_order = self.visible_orders[row]
        self.show_order(self.current_order)

    def clear_detail_layout(self) -> None:
        while self.detail_layout.count():
            item = self.detail_layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
            child_layout = item.layout()
            if child_layout is not None:
                while child_layout.count():
                    child = child_layout.takeAt(0)
                    if child.widget() is not None:
                        child.widget().deleteLater()

    def show_empty_details(self, text: str) -> None:
        self.clear_detail_layout()
        label = QLabel(text)
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        label.setObjectName("mutedLabel")
        self.detail_layout.addStretch()
        self.detail_layout.addWidget(label)
        self.detail_layout.addStretch()

    def section_title(self, text: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName("sectionLabel")
        return label

    def show_order(self, order: dict[str, Any]) -> None:
        self.clear_detail_layout()
        customer = order.get("customer") or {}
        shipping = order.get("shipping") or {}
        fulfilment = order.get("fulfilment") or {}
        status = self.order_status(order)

        top_row = QHBoxLayout()
        title_box = QVBoxLayout()
        customer_name = QLabel(customer.get("name") or "Unknown customer")
        customer_name.setObjectName("titleLabel")
        email = QLabel(customer.get("email") or "No email address")
        email.setObjectName("mutedLabel")
        title_box.addWidget(customer_name)
        title_box.addWidget(email)
        top_row.addLayout(title_box)
        top_row.addStretch()

        badge = QLabel("DISPATCHED" if status == "dispatched" else "PENDING")
        badge.setObjectName("statusDispatched" if status == "dispatched" else "statusPending")
        top_row.addWidget(badge, alignment=Qt.AlignmentFlag.AlignTop)
        self.detail_layout.addLayout(top_row)

        meta = QLabel(
            f"{created_text(order.get('created'))}   •   {money(order.get('amountTotal'))}   •   {order.get('id', '')}"
        )
        meta.setObjectName("mutedLabel")
        meta.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.detail_layout.addWidget(meta)

        summary = QFrame()
        summary.setObjectName("summaryFrame")
        summary_layout = QHBoxLayout(summary)
        summary_layout.setContentsMargins(16, 14, 16, 14)
        summary_layout.setSpacing(28)

        address_box = QVBoxLayout()
        address_box.addWidget(self.section_title("Delivery address"))
        address = QLabel(address_text(shipping.get("address")))
        address.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        address_box.addWidget(address)
        copy_address = QPushButton("Copy address")
        copy_address.setObjectName("secondaryButton")
        copy_address.clicked.connect(lambda: QGuiApplication.clipboard().setText(address_text(shipping.get("address"), False)))
        address_box.addWidget(copy_address, alignment=Qt.AlignmentFlag.AlignLeft)
        summary_layout.addLayout(address_box, 2)

        postage_box = QVBoxLayout()
        postage_box.addWidget(self.section_title("Postage"))
        postage = QLabel(shipping.get("service") or "Unknown service")
        postage.setWordWrap(True)
        postage_box.addWidget(postage)
        postage_cost = QLabel(money(shipping.get("amount")))
        postage_cost.setObjectName("mutedLabel")
        postage_box.addWidget(postage_cost)
        postage_box.addStretch()
        summary_layout.addLayout(postage_box, 1)
        self.detail_layout.addWidget(summary)

        self.detail_layout.addWidget(self.section_title("What to make / pack"))
        items = order.get("items") or []
        table = QTableWidget(len(items), 8)
        table.setHorizontalHeaderLabels(["Product", "Qty", "Configuration", "Lid", "Base", "Left", "Right", "Line total"])
        table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        table.setSelectionMode(QTableWidget.SelectionMode.NoSelection)
        table.verticalHeader().setVisible(False)
        table.setAlternatingRowColors(False)
        table.setMinimumHeight(max(180, 54 + (len(items) * 40)))

        for row, product_item in enumerate(items):
            colours = product_item.get("colours") or {}
            quantity = int(product_item.get("quantity") or 0)
            unit_amount = int(product_item.get("unitAmount") or 0)
            values = [
                product_item.get("name") or product_item.get("product") or "Item",
                str(quantity),
                product_item.get("configuration") or "-",
                colours.get("lid") or "-",
                colours.get("base") or "-",
                colours.get("leftButton") or "-",
                colours.get("rightButton") or "-",
                money(unit_amount * quantity),
            ]
            for column, value in enumerate(values):
                cell = QTableWidgetItem(str(value))
                if column in (1, 7):
                    cell.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                table.setItem(row, column, cell)

        header = table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for column in range(1, 8):
            header.setSectionResizeMode(column, QHeaderView.ResizeMode.ResizeToContents)
        self.detail_layout.addWidget(table)

        fulfilment_frame = QFrame()
        fulfilment_frame.setObjectName("summaryFrame")
        fulfilment_layout = QVBoxLayout(fulfilment_frame)
        fulfilment_layout.setContentsMargins(16, 14, 16, 14)
        fulfilment_layout.addWidget(self.section_title("Fulfilment"))

        if status == "dispatched":
            dispatched_at = fulfilment.get("dispatchedAt") or "Unknown time"
            tracking_number = fulfilment.get("trackingNumber") or "No tracking number saved"
            info = QLabel(f"Dispatched: {dispatched_at}\nTracking: {tracking_number}")
            info.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            fulfilment_layout.addWidget(info)
        else:
            tracking_label = QLabel("Royal Mail tracking number (optional)")
            tracking_label.setObjectName("mutedLabel")
            fulfilment_layout.addWidget(tracking_label)
            self.tracking_input = QLineEdit()
            self.tracking_input.setPlaceholderText("Leave blank for untracked orders")
            fulfilment_layout.addWidget(self.tracking_input)

            dispatch_button = QPushButton("Mark as dispatched and email customer")
            dispatch_button.clicked.connect(self.dispatch_current_order)
            fulfilment_layout.addWidget(dispatch_button, alignment=Qt.AlignmentFlag.AlignLeft)

        self.detail_layout.addWidget(fulfilment_frame)
        self.detail_layout.addStretch()

    def dispatch_current_order(self) -> None:
        if not self.current_order:
            return

        customer = self.current_order.get("customer") or {}
        email = customer.get("email") or "the customer"
        tracking_number = self.tracking_input.text().strip() if hasattr(self, "tracking_input") else ""

        answer = QMessageBox.question(
            self,
            "Dispatch order?",
            f"This will email {email} and mark the order as dispatched in Stripe.\n\nContinue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return

        self.set_busy(True, "Sending dispatch email...")
        try:
            result = api_request(
                "/api/admin/dispatch",
                self.admin_key,
                method="POST",
                body={
                    "sessionId": self.current_order.get("id"),
                    "trackingNumber": tracking_number,
                },
            )
        except RuntimeError as error:
            QMessageBox.critical(self, "Dispatch failed", str(error))
            self.statusBar().showMessage("Dispatch failed")
            return
        finally:
            self.set_busy(False)

        if result.get("alreadyDispatched"):
            QMessageBox.information(self, "Already dispatched", "This order was already marked as dispatched. No duplicate email was sent.")
        else:
            QMessageBox.information(self, "Order dispatched", "Dispatch email sent and the Stripe order has been marked as dispatched.")

        self.refresh_orders()


def get_admin_key() -> str:
    key = os.environ.get(ADMIN_KEY_ENV, "").strip()
    if key:
        return key

    key, accepted = QInputDialog.getText(
        None,
        "NiceHatThanks Orders",
        "ORDER_ADMIN_KEY:",
        QLineEdit.EchoMode.Password,
    )
    return key.strip() if accepted else ""


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("NiceHatThanks Orders")
    app.setStyle("Fusion")
    app.setStyleSheet(APP_STYLESHEET)

    admin_key = get_admin_key()
    if not admin_key:
        return 0

    window = OrderWindow(admin_key)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
