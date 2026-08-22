"""NiceHatThanks fulfilment GUI with automatic local Excel ledger sync."""

from __future__ import annotations

import os
import sys

from PySide6.QtWidgets import QApplication, QMessageBox, QPushButton

import orders_gui
from ledger import sync_ledger


class LedgerOrderWindow(orders_gui.OrderWindow):
    def __init__(self, admin_key: str):
        self.ledger_path = None
        self.ledger_mode = "test"
        super().__init__(admin_key)

    def _build_ui(self) -> None:
        super()._build_ui()
        self.ledger_button = QPushButton("Open finance workbook")
        self.ledger_button.setObjectName("secondaryButton")
        self.ledger_button.clicked.connect(self.open_ledger)
        self.statusBar().addPermanentWidget(self.ledger_button)

    def refresh_orders(self) -> None:
        selected_id = self.current_order.get("id") if self.current_order else None
        self.set_busy(True, "Loading paid Stripe orders...")
        try:
            payload = orders_gui.api_request("/api/admin/orders", self.admin_key)
            self.orders = payload.get("orders") or []
            self.ledger_mode = payload.get("mode") or "test"

            try:
                self.ledger_path = sync_ledger(self.orders, self.ledger_mode)
                ledger_message = f"Ledger synced: {self.ledger_path.name}"
            except PermissionError:
                ledger_message = "Ledger not synced - close the workbook in Excel and refresh"
            except Exception as error:
                ledger_message = f"Ledger sync failed: {error}"
        except RuntimeError as error:
            QMessageBox.critical(self, "Unable to load orders", str(error))
            self.statusBar().showMessage("Unable to load orders")
            return
        finally:
            self.set_busy(False)

        self.apply_filter(selected_id)
        self.statusBar().showMessage(
            f"Loaded {len(self.orders)} paid sandbox order(s) - {ledger_message}",
            8000,
        )

    def open_ledger(self) -> None:
        if self.ledger_path is None or not self.ledger_path.exists():
            try:
                self.ledger_path = sync_ledger(self.orders, self.ledger_mode)
            except Exception as error:
                QMessageBox.critical(self, "Unable to open finance workbook", str(error))
                return

        try:
            if os.name == "nt":
                os.startfile(self.ledger_path)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                import subprocess
                subprocess.Popen(["open", str(self.ledger_path)])
            else:
                import subprocess
                subprocess.Popen(["xdg-open", str(self.ledger_path)])
        except Exception as error:
            QMessageBox.critical(
                self,
                "Unable to open finance workbook",
                f"{error}\n\nWorkbook: {self.ledger_path}",
            )


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("NiceHatThanks Orders")
    app.setStyle("Fusion")
    app.setStyleSheet(orders_gui.APP_STYLESHEET)

    admin_key = orders_gui.get_admin_key()
    if not admin_key:
        return 0

    window = LedgerOrderWindow(admin_key)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
