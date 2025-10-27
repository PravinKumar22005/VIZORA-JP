import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import SessionLocal
from models.dashboard import Dashboard


def fix_dashboard_json():
    session = SessionLocal()
    dashboards = session.query(Dashboard).all()
    fixed = 0
    for dash in dashboards:
        if not isinstance(dash.dashboard_json, list):
            # If it's a dict, wrap in a list; if something else, skip or fix as needed
            if isinstance(dash.dashboard_json, dict):
                dash.dashboard_json = [dash.dashboard_json]
                fixed += 1
            else:
                print(
                    f"Dashboard {dash.id} has invalid dashboard_json: {type(dash.dashboard_json)}"
                )
    session.commit()
    print(f"Fixed {fixed} dashboards.")
    session.close()


if __name__ == "__main__":
    fix_dashboard_json()
