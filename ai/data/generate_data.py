import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_parking_dataset(output_path: str, num_days: int = 90):
    np.random.seed(42)
    random.seed(42)
    
    locations = [
        {"name": "Chennai Mall", "total_slots": 150, "type": "mall"},
        {"name": "T Nagar Commercial Hub", "total_slots": 120, "type": "commercial"},
        {"name": "Velachery Metro Station", "total_slots": 200, "type": "transit"},
        {"name": "OMR IT Park", "total_slots": 300, "type": "office"},
        {"name": "Anna Nagar Center", "total_slots": 100, "type": "mixed"},
        {"name": "Guindy Corporate Park", "total_slots": 180, "type": "office"}
    ]
    
    start_date = datetime(2026, 6, 1)
    records = []
    
    for day_offset in range(num_days):
        current_date = start_date + timedelta(days=day_offset)
        date_str = current_date.strftime("%Y-%m-%d")
        day_of_week = current_date.weekday() # 0 = Monday, 6 = Sunday
        is_weekend = day_of_week in [5, 6]
        
        for loc in locations:
            total_slots = loc["total_slots"]
            loc_type = loc["type"]
            
            for hour in range(24):
                # Calculate base occupancy factor (0.0 to 1.0)
                if loc_type == "office":
                    if is_weekend:
                        base_rate = np.random.uniform(0.05, 0.20)
                    else:
                        if 8 <= hour <= 10:
                            base_rate = np.random.uniform(0.70, 0.95)
                        elif 11 <= hour <= 16:
                            base_rate = np.random.uniform(0.80, 0.98)
                        elif 17 <= hour <= 19:
                            base_rate = np.random.uniform(0.50, 0.75)
                        elif 20 <= hour <= 22:
                            base_rate = np.random.uniform(0.15, 0.35)
                        else:
                            base_rate = np.random.uniform(0.02, 0.10)
                elif loc_type == "mall":
                    if is_weekend:
                        if 11 <= hour <= 14:
                            base_rate = np.random.uniform(0.70, 0.90)
                        elif 15 <= hour <= 21:
                            base_rate = np.random.uniform(0.85, 0.98)
                        elif 22 <= hour <= 23:
                            base_rate = np.random.uniform(0.30, 0.50)
                        elif 0 <= hour <= 10:
                            base_rate = np.random.uniform(0.05, 0.30)
                    else:
                        if 12 <= hour <= 15:
                            base_rate = np.random.uniform(0.40, 0.65)
                        elif 17 <= hour <= 21:
                            base_rate = np.random.uniform(0.65, 0.88)
                        elif 22 <= hour <= 23:
                            base_rate = np.random.uniform(0.20, 0.40)
                        else:
                            base_rate = np.random.uniform(0.05, 0.25)
                elif loc_type == "transit":
                    if is_weekend:
                        base_rate = np.random.uniform(0.20, 0.50)
                    else:
                        if 7 <= hour <= 10:
                            base_rate = np.random.uniform(0.80, 0.98)
                        elif 11 <= hour <= 16:
                            base_rate = np.random.uniform(0.70, 0.88)
                        elif 17 <= hour <= 20:
                            base_rate = np.random.uniform(0.85, 0.99)
                        elif 21 <= hour <= 23:
                            base_rate = np.random.uniform(0.30, 0.55)
                        else:
                            base_rate = np.random.uniform(0.05, 0.20)
                elif loc_type == "commercial":
                    if is_weekend:
                        if 11 <= hour <= 21:
                            base_rate = np.random.uniform(0.80, 0.98)
                        else:
                            base_rate = np.random.uniform(0.15, 0.45)
                    else:
                        if 10 <= hour <= 19:
                            base_rate = np.random.uniform(0.60, 0.85)
                        elif 20 <= hour <= 22:
                            base_rate = np.random.uniform(0.35, 0.60)
                        else:
                            base_rate = np.random.uniform(0.05, 0.20)
                else: # mixed
                    if is_weekend:
                        if 12 <= hour <= 22:
                            base_rate = np.random.uniform(0.70, 0.92)
                        else:
                            base_rate = np.random.uniform(0.15, 0.40)
                    else:
                        if 12 <= hour <= 15 or 18 <= hour <= 21:
                            base_rate = np.random.uniform(0.65, 0.88)
                        elif 8 <= hour <= 11 or 16 <= hour <= 17:
                            base_rate = np.random.uniform(0.40, 0.65)
                        else:
                            base_rate = np.random.uniform(0.05, 0.25)
                
                # Add minor noise
                noise = np.random.normal(0, 0.03)
                final_rate = np.clip(base_rate + noise, 0.02, 1.0)
                
                occupied = int(round(final_rate * total_slots))
                occupied = max(0, min(occupied, total_slots))
                available = total_slots - occupied
                occupancy_rate = round((occupied / total_slots) * 100, 2)
                
                # Advance bookings correlate with occupancy and busy hours
                booking_rate = final_rate * np.random.uniform(0.2, 0.5)
                bookings = int(round(booking_rate * total_slots))
                
                # Determine demand level
                if occupancy_rate < 50:
                    demand_level = "LOW"
                elif occupancy_rate < 80:
                    demand_level = "MEDIUM"
                else:
                    demand_level = "HIGH"
                
                # Historical occupancy simulated from base rate + noise
                hist_occ = round(float(np.clip(base_rate * 100 + np.random.normal(0, 5), 5.0, 98.0)), 2)
                
                records.append({
                    "location": loc["name"],
                    "date": date_str,
                    "hour": hour,
                    "day_of_week": day_of_week,
                    "total_slots": total_slots,
                    "occupied_slots": occupied,
                    "available_slots": available,
                    "bookings": bookings,
                    "historical_occupancy": hist_occ,
                    "occupancy_rate": occupancy_rate,
                    "demand_level": demand_level
                })
                
    df = pd.DataFrame(records)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Dataset generated successfully at {output_path} with {len(df)} records.")
    return df

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "parking_data.csv")
    generate_parking_dataset(out_file)
