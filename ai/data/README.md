# SmartPark Parking Dataset

> **Note**: This dataset is a **synthetic dataset** created for development, testing, and demonstration of the SmartPark AI prediction models. It simulates realistic urban parking occupancy patterns across multiple facility types (Malls, Commercial districts, Transit hubs, Office parks).

---

## Dataset Overview

- **File**: `parking_data.csv`
- **Total Records**: 12,960 hourly observation rows
- **Time Range**: June 1, 2026 to August 31, 2026 (90 days, 24 hours/day)
- **Locations Covered**:
  - `Chennai Mall` (150 total slots) - Retail / weekend peak behavior
  - `T Nagar Commercial Hub` (120 total slots) - Shopping district behavior
  - `Velachery Metro Station` (200 total slots) - Commuter transit hub behavior
  - `OMR IT Park` (300 total slots) - Corporate office weekday rush behavior
  - `Anna Nagar Center` (100 total slots) - Mixed commercial & restaurant behavior
  - `Guindy Corporate Park` (180 total slots) - Business tech park behavior

---

## Data Schema & Column Descriptions

| Column | Data Type | Description | Values / Range |
| :--- | :--- | :--- | :--- |
| `location` | `string` | Name of the parking facility | E.g. "Chennai Mall", "OMR IT Park" |
| `date` | `string` (YYYY-MM-DD) | Observation date | 2026-06-01 to 2026-08-31 |
| `hour` | `integer` | Hour of the day in 24-hour format | 0 – 23 |
| `day_of_week` | `integer` | Day of week (ISO weekday standard) | 0 (Monday) – 6 (Sunday) |
| `total_slots` | `integer` | Total capacity of the parking facility | 100 – 300 |
| `occupied_slots`| `integer` | Number of currently occupied slots | 0 – total_slots |
| `available_slots`| `integer`| Number of free slots (`total_slots - occupied_slots`) | 0 – total_slots |
| `bookings` | `integer` | Number of reservations made in advance | 0 – total_slots |
| `occupancy_rate`| `float` | Percentage of total slots occupied | 0.0% – 100.0% |
| `demand_level` | `string` | Categorical demand indicator | `LOW` (<50%), `MEDIUM` (50–80%), `HIGH` (≥80%) |

---

## Patterns & Distribution

1. **Office / Corporate Parks (`OMR IT Park`, `Guindy Corporate Park`)**:
   - High occupancy during weekday business hours (08:00–18:00), tapering off in evenings.
   - Very low occupancy during weekends and late nights.
2. **Shopping Malls (`Chennai Mall`, `Anna Nagar Center`)**:
   - Peak occupancy on Friday evenings and weekend afternoons/nights (12:00–22:00).
   - Moderate occupancy on weekday afternoons and evenings.
3. **Transit Hubs (`Velachery Metro Station`)**:
   - Distinct morning rush (07:00–10:00) and evening return rush (17:00–20:00) on weekdays.
   - Lower steady traffic on weekends.
4. **Commercial Hubs (`T Nagar Commercial Hub`)**:
   - Sustained heavy traffic across all peak retail shopping hours (11:00–21:00).

---

## Re-generating Dataset

To regenerate the synthetic data at any time:

```bash
python ai/data/generate_data.py
```
