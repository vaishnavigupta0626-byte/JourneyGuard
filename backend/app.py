from pathlib import Path



import pandas as pd

from flask import Flask, jsonify, request

from flask_cors import CORS



app = Flask(__name__)

CORS(app)



# --------------------------------------------------

# Configuration

# --------------------------------------------------



SESSION_FILE = (

    Path.home()

    / "Hackathon"

    / "ai"

    / "data"

    / "raw"

    / "session_features.csv"

)



sessions = None





# --------------------------------------------------

# Helper functions

# --------------------------------------------------



def truthy(series):

    """Convert common text and numeric values into booleans."""

    return (

        series.astype(str)

        .str.strip()

        .str.lower()

        .isin(["true", "1", "yes"])

    )





def load_sessions():

    """Load the CSV and assign rule-based risk levels."""

    global sessions



    if not SESSION_FILE.exists():

        raise FileNotFoundError(

            f"Session data file was not found: {SESSION_FILE}"

        )



    df = pd.read_csv(SESSION_FILE)



    required_columns = {

        "session_id",

        "customer_id",

        "event_count",

        "views",

        "add_to_cart",

        "transactions",

        "duration_minutes",

        "potential_friction",

        "potential_abandonment",

    }



    missing = required_columns - set(df.columns)



    if missing:

        raise ValueError(

            "Missing required CSV columns: "

            + ", ".join(sorted(missing))

        )



    numeric_columns = [

        "event_count",

        "views",

        "add_to_cart",

        "transactions",

        "duration_minutes",

    ]



    for column in numeric_columns:

        df[column] = pd.to_numeric(

            df[column], errors="coerce"

        ).fillna(0)



    friction = truthy(df["potential_friction"])

    abandonment = truthy(df["potential_abandonment"])



    cart_without_transaction = (

        (df["add_to_cart"] > 0)

        & (df["transactions"] == 0)

    )

    # Diagnostic counts to explain the risk distribution.
    print("Friction flags:", int(friction.sum()))
    print("Abandonment flags:", int(abandonment.sum()))
    print("Both flags:", int((friction & abandonment).sum()))
    print("Cart without transaction:", int(cart_without_transaction.sum()))



    # Heuristic risk labels, not machine-learning predictions.

    # Keep these label rules aligned with make_journey()'s explainable score:

    # friction (+40), abandonment (+40), cart without transaction (+20).

    df["_risk_score"] = (

        friction.astype(int) * 40

        + abandonment.astype(int) * 40

        + cart_without_transaction.astype(int) * 20

    ).clip(upper=100)



    df["_risk"] = "Low"

    df.loc[df["_risk_score"] >= 20, "_risk"] = "Medium"

    df.loc[df["_risk_score"] >= 80, "_risk"] = "High"



    df["_risk_order"] = df["_risk"].map({

        "High": 0,

        "Medium": 1,

        "Low": 2,

    })



    sessions = (

        df.sort_values(

            ["_risk_order", "event_count"],

            ascending=[True, False],

        )

        .reset_index(drop=True)

    )





def make_journey(row):

    """Convert a session row into a JSON-friendly journey."""

    transactions = int(row["transactions"])

    cart_activity = int(row["add_to_cart"])

    views = int(row["views"])



    if transactions > 0:

        stage = "Converted"

    elif cart_activity > 0:

        stage = "Checkout"

    elif views > 0:

        stage = "Browsing"

    else:

        stage = "Entry"



    friction = str(row["potential_friction"]).strip().lower() in {

        "true", "1", "yes"

    }



    abandonment = str(

        row["potential_abandonment"]

    ).strip().lower() in {"true", "1", "yes"}



    cart_without_transaction = cart_activity > 0 and transactions == 0



    # Transparent heuristic score: these weights are product rules, not a

    # trained or calibrated machine-learning probability. This matches the

    # score used to assign the session's risk label in load_sessions().

    risk_score = int(row["_risk_score"])

    risk_reasons = []



    if friction:

        risk_reasons.append("Potential friction flag (+40)")



    if abandonment:

        risk_reasons.append("Potential abandonment flag (+40)")



    if cart_without_transaction:

        risk_reasons.append("Cart activity without a transaction (+20)")



    if not risk_reasons:

        risk_reasons.append("No configured risk signals were triggered")



    if friction and abandonment:

        issue = "Potential friction and abandonment signals"

    elif friction:

        issue = "Potential friction signal"

    elif abandonment:

        issue = "Potential abandonment signal"

    elif cart_activity > 0 and transactions == 0:

        issue = "Cart activity without a transaction"

    elif transactions > 0:

        issue = "Transaction recorded"

    else:

        issue = "No major rule-based flag"



    if row["_risk"] == "High":

        action = (

            "Review the session timeline and investigate "

            "possible navigation or checkout barriers."

        )

    elif row["_risk"] == "Medium":

        action = (

            "Inspect the recorded events and check whether "

            "the customer journey encountered an obstacle."

        )

    else:

        action = (

            "Continue monitoring; no high-priority rule "

            "was triggered by the current heuristics."

        )



    evidence = []



    if friction:

        evidence.append("Potential friction flag")



    if abandonment:

        evidence.append("Potential abandonment flag")



    if cart_activity > 0:

        evidence.append(f"Add-to-cart events: {cart_activity}")



    if transactions > 0:

        evidence.append(f"Transactions: {transactions}")

    elif cart_activity > 0:

        evidence.append("No transaction recorded")



    if not evidence:

        evidence.append("No specific risk indicator recorded")



    return {

        "id": str(row["session_id"]),

        "customer": str(row["customer_id"]),

        "stage": stage,

        "issue": issue,

        "risk": str(row["_risk"]),

        "risk_score": risk_score,

        "risk_reasons": risk_reasons,

        "action": action,

        "evidence": evidence,

        "event_count": int(row["event_count"]),

        "views": views,

        "add_to_cart": cart_activity,

        "transactions": transactions,

        "duration_minutes": float(row["duration_minutes"]),

    }





# --------------------------------------------------

# Health and status

# --------------------------------------------------



@app.route("/", methods=["GET"])

def home():

    return jsonify({

        "app": "JourneyGuard API",

        "status": "running",

        "endpoints": [

            "/health",

            "/api/summary",

            "/api/analytics",

            "/api/journeys",

            "/api/insights",

            "/api/priorities",

        ],

    })





@app.route("/health", methods=["GET"])

def health():

    return jsonify({

        "status": "ok",

        "data_loaded": sessions is not None,

    })





# --------------------------------------------------

# Dashboard summary

# --------------------------------------------------



@app.route("/api/summary", methods=["GET"])

def get_summary():

    if sessions is None:

        return jsonify({

            "error": "Session data is not loaded"

        }), 503



    risk_counts = sessions["_risk"].value_counts().to_dict()



    return jsonify({

        "total_sessions": int(len(sessions)),

        "high_risk": int(risk_counts.get("High", 0)),

        "medium_risk": int(risk_counts.get("Medium", 0)),

        "low_risk": int(risk_counts.get("Low", 0)),

        "data_source": str(SESSION_FILE),

    })





# --------------------------------------------------

# Conversion analytics (NEW)

# --------------------------------------------------



@app.route("/api/analytics", methods=["GET"])

def get_analytics():

    if sessions is None:

        return jsonify({

            "error": "Session data is not loaded"

        }), 503



    total = int(len(sessions))



    converted = int(

        (sessions["transactions"] > 0).sum()

    )



    cart_without_transaction = int(

        (

            (sessions["add_to_cart"] > 0)

            & (sessions["transactions"] == 0)

        ).sum()

    )



    high_risk = int(

        (sessions["_risk"] == "High").sum()

    )



    conversion_rate = (

        round(converted / total * 100, 2)

        if total > 0 else 0.0

    )



    cart_without_transaction_rate = (

        round(cart_without_transaction / total * 100, 2)

        if total > 0 else 0.0

    )



    high_risk_rate = (

        round(high_risk / total * 100, 2)

        if total > 0 else 0.0

    )



    return jsonify({

        "total_sessions": total,

        "sessions_with_transactions": converted,

        "conversion_rate_percent": conversion_rate,

        "cart_without_transaction": cart_without_transaction,

        "cart_without_transaction_percent": cart_without_transaction_rate,

        "high_risk_sessions": high_risk,

        "high_risk_percent": high_risk_rate,

        "method": "descriptive dataset analytics",

        "note": (

            "These are session-level metrics. A session with a transaction "

            "is counted as converted; cart activity without a transaction "

            "does not by itself prove abandonment."

        ),

    })





# --------------------------------------------------

# Customer journeys and risk filters

# --------------------------------------------------



@app.route("/api/journeys", methods=["GET"])

def get_journeys():

    if sessions is None:

        return jsonify({

            "error": "Session data is not loaded"

        }), 503



    risk = request.args.get("risk", "All").strip().title()



    if risk not in {"All", "High", "Medium", "Low"}:

        return jsonify({

            "error": "Invalid risk filter. Use All, High, Medium, or Low."

        }), 400



    try:

        limit = int(request.args.get("limit", 100))

    except ValueError:

        return jsonify({

            "error": "Limit must be an integer"

        }), 400



    limit = max(1, min(limit, 500))



    filtered = sessions



    if risk != "All":

        filtered = filtered[filtered["_risk"] == risk]



    selected = filtered.head(limit)



    return jsonify({

        "count": int(len(selected)),

        "total_matching": int(len(filtered)),

        "risk_filter": risk,

        "journeys": [

            make_journey(row)

            for _, row in selected.iterrows()

        ],

        "note": (

            "Risk labels are heuristic indicators, "

            "not verified predictions of customer behavior."

        ),

    })





# --------------------------------------------------

# Friction Insights

# --------------------------------------------------



@app.route("/api/insights", methods=["GET"])

def get_insights():

    if sessions is None:

        return jsonify({

            "error": "Session data is not loaded"

        }), 503



    df = sessions



    friction_count = int(

        truthy(df["potential_friction"]).sum()

    )



    abandonment_count = int(

        truthy(df["potential_abandonment"]).sum()

    )



    cart_no_purchase_count = int(

        (

            (df["add_to_cart"] > 0)

            & (df["transactions"] == 0)

        ).sum()

    )



    insights = [

        {

            "id": "cart-no-purchase",

            "title": "Cart activity without a transaction",

            "count": cart_no_purchase_count,

            "severity": (

                "Review" if cart_no_purchase_count > 0 else "Low"

            ),

            "recommendation": (

                "Review checkout usability, shipping costs, "

                "and payment errors. Cart activity alone does "

                "not prove that a customer abandoned a purchase."

            ),

        },

        {

            "id": "friction-signals",

            "title": "Potential friction indicators",

            "count": friction_count,

            "severity": (

                "Review" if friction_count > 0 else "Low"

            ),

            "recommendation": (

                "Inspect flagged sessions and investigate "

                "possible navigation, product-information, "

                "or checkout obstacles."

            ),

        },

        {

            "id": "abandonment-signals",

            "title": "Potential abandonment indicators",

            "count": abandonment_count,

            "severity": (

                "Review" if abandonment_count > 0 else "Low"

            ),

            "recommendation": (

                "Review the last recorded events in flagged "

                "sessions to identify possible barriers "

                "in the customer journey."

            ),

        },

    ]



    return jsonify({

        "total_sessions": int(len(df)),

        "insights": insights,

        "method": "rule-based analysis",

        "note": (

            "These counts describe dataset indicators and "

            "do not establish the cause of customer behavior."

        ),

    })





# --------------------------------------------------

# Top Priority Journeys

# --------------------------------------------------



@app.route("/api/priorities", methods=["GET"])

def get_priorities():

    if sessions is None:

        return jsonify({

            "error": "Session data is not loaded"

        }), 503



    priority_sessions = (

        sessions[

            sessions["_risk"].isin(["High", "Medium"])

        ]

        .head(10)

    )



    return jsonify({

        "count": int(len(priority_sessions)),

        "priorities": [

            make_journey(row)

            for _, row in priority_sessions.iterrows()

        ],

        "method": "rule-based risk ordering",

        "note": (

            "Priorities are review suggestions, not proof "

            "of customer intent or the cause of friction."

        ),

    })





# --------------------------------------------------

# Start the server

# --------------------------------------------------



if __name__ == "__main__":

    load_sessions()



    print(f"Loaded {len(sessions):,} sessions.")

    print(f"Data source: {SESSION_FILE}")

    print("JourneyGuard API: http://127.0.0.1:5000")



    app.run(

        host="127.0.0.1",

        port=5000,

        debug=True,

    )
