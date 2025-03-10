from flask import Flask, request, jsonify
import google.generativeai as genai
import json
import re
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)  # Set logging level to DEBUG

genai.configure(api_key="AIzaSyAteijvdxtS4K1BiAm993KvNXTVymTr4NU")  # Replace with your actual API key

@app.route("/generate_travel_plan", methods=["POST"])
def generate_travel_plan():
    data = request.json
    preferences = data.get("preferences", {})

    departure = preferences.get("departure", "Unknown")
    destination = preferences.get("destination", "Unknown")
    budget = preferences.get("budget", "Not specified")
    activities = preferences.get("activities", "Not specified")

    prompt = f"""You are a travel planning assistant. Create a detailed travel plan from {departure} to {destination} with a budget of {budget}.
    Preferred activities: {activities}.

    You MUST respond in EXACTLY the following JSON format. No other text is allowed.  Ensure the budget is a number. Ensure each day has a valid cost. Be concise.

    {{
        "trip_name": "string - A short name for the trip",
        "budget": number,
        "origin_coordinates": {{"latitude": number, "longitude": number}},
        "destination": "string - The destination city",
        "theme": "string - E.g., "Adventure", "Relaxation", "Cultural"",
        "duration": "string - E.g., "5 days"",
        "day_itinerary": [
            {{
                "day": number,
                "title": "string - A brief title for the day's activities",
                "description": "string - A short description of the day",
                "activities": ["string - list of activites"],
                "estimated_cost": number
            }}
        ]
    }}
    ONLY return the JSON, do not use Markdown or any other formatting."""

    try:
        model = genai.GenerativeModel("gemini-1.5-pro") # Using a proper model name
        response = model.generate_content(prompt)
        response_text = response.text
        print(response.text)

        # Extract JSON using regex (more robust)
        match = re.search(r'\{.*\}', response_text, re.DOTALL)

        if match:
            extracted_json = match.group(0)
            try:
                travel_plan = json.loads(extracted_json)  # Convert string to JSON
            except json.JSONDecodeError as json_err:
                app.logger.error(f"JSONDecodeError: {str(json_err)}  Response Text: {response_text}")
                return jsonify({"error": f"Invalid JSON format: {str(json_err)}  (Check server logs)"}), 500
        else:
            app.logger.error(f"No JSON found in response. Response Text: {response_text}")
            return jsonify({"error": "No JSON found in the response (Check server logs)"}), 500

        return jsonify(travel_plan)

    except Exception as e:
        app.logger.error(f"Error generating travel plan: {str(e)}")  # Log the full error
        return jsonify({"error": f"Failed to generate plan: {str(e)}. Check server logs."}), 500
        

if __name__ == "__main__":
    app.run(debug=True)