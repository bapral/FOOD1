import pandas as pd
import json
import time
import os
from geopy.geocoders import ArcGIS
from geopy.exc import GeocoderTimedOut

import sys
import io

# Fix for Windows terminal encoding issues
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def geocode_with_retry(geolocator, address, retries=3):
    for i in range(retries):
        try:
            # ArcGIS is generally faster and has higher limits
            return geolocator.geocode(address, timeout=15)
        except Exception as e:
            if i < retries - 1:
                print(f"  Retry {i+1} due to error: {e}")
                time.sleep(2)
            else:
                print(f"  Failed after {retries} retries: {e}")
    return None

def build_data():
    print("Reading Excel file...")
    try:
        df = pd.read_excel('Alma_Food_Map_Final.xlsx')
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return
    
    mapping = {
        df.columns[0]: 'city',
        df.columns[1]: 'district',
        df.columns[2]: 'name',
        df.columns[3]: 'address',
        df.columns[4]: 'phone',
        df.columns[5]: 'hours',
        df.columns[6]: 'link'
    }
    df = df.rename(columns=mapping)
    
    # ArcGIS is much faster than Nominatim for free usage
    geolocator = ArcGIS(user_agent="alma_food_map_v2_bapral")
    
    # Load existing progress if any
    food_list = []
    if os.path.exists('food_data.json'):
        with open('food_data.json', 'r', encoding='utf-8') as f:
            food_list = json.load(f)
            print(f"Loaded {len(food_list)} existing items.")

    start_index = len(food_list)
    print(f"Starting FAST geocoding from index {start_index} for {len(df)} total items...")
    
    try:
        for index, row in df.iloc[start_index:].iterrows():
            name = str(row['name'])
            address = str(row['address'])
            clean_address = address.split('(')[0].strip()
            
            # Print simplified progress to avoid log bloating
            if (index + 1) % 10 == 1:
                print(f"[{index+1}/{len(df)}] Processing: {name}", flush=True)
            
            lat, lng = None, None
            location = geocode_with_retry(geolocator, clean_address)
            if location:
                lat, lng = location.latitude, location.longitude
            else:
                # Fallback: City + Name
                location = geocode_with_retry(geolocator, f"{row['city']} {name}")
                if location:
                    lat, lng = location.latitude, location.longitude
            
            food_list.append({
                "name": name,
                "address": address,
                "phone": str(row['phone']) if pd.notna(row['phone']) else "",
                "hours": str(row['hours']) if pd.notna(row['hours']) else "",
                "link": str(row['link']) if pd.notna(row['link']) else "",
                "lat": lat,
                "lng": lng,
                "city": str(row['city']),
                "district": str(row['district'])
            })
            
            # Save every 50 items for speed
            if (index + 1) % 50 == 0:
                with open('food_data.json', 'w', encoding='utf-8') as f:
                    json.dump(food_list, f, ensure_ascii=False, indent=2)
                print(f"  >>> Checkpoint: {index+1} items saved.", flush=True)
            
            time.sleep(0.2) # ArcGIS is much more permissive
            
    except KeyboardInterrupt:
        print("\nProcess interrupted. Saving current progress...")
    finally:
        with open('food_data.json', 'w', encoding='utf-8') as f:
            json.dump(food_list, f, ensure_ascii=False, indent=2)
        print(f"Final save completed. Total items: {len(food_list)}")

if __name__ == "__main__":
    build_data()
