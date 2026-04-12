import pandas as pd
import json
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

def geocode_with_retry(geolocator, address, retries=3):
    for i in range(retries):
        try:
            return geolocator.geocode(address, timeout=10)
        except GeocoderTimedOut:
            if i < retries - 1:
                time.sleep(2)
            else:
                raise
    return None

def build_data():
    print("Reading Excel file...")
    # Read excel without assuming header names first if encoding is tricky
    df = pd.read_excel('Alma_Food_Map_Final.xlsx')
    
    # Map columns based on order if names are garbled in some environments
    # Expected: City, District, Name, Address, Phone, Hours, Link
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
    
    geolocator = Nominatim(user_agent="food_map_app_alma")
    food_list = []
    
    print(f"Starting geocoding for {len(df)} items...")
    for index, row in df.iterrows():
        name = str(row['name'])
        address = str(row['address'])
        
        # Clean address (e.g., removing "(xx樓)")
        clean_address = address.split('(')[0].strip()
        
        print(f"[{index+1}/{len(df)}] Geocoding: {name} @ {clean_address}")
        
        lat, lng = None, None
        try:
            location = geocode_with_retry(geolocator, clean_address)
            if location:
                lat, lng = location.latitude, location.longitude
            else:
                # Try with name + city if address fails
                location = geocode_with_retry(geolocator, f"{row['city']} {name}")
                if location:
                    lat, lng = location.latitude, location.longitude
        except Exception as e:
            print(f"Error geocoding {name}: {e}")
        
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
        
        # Nominatim policy: 1 request per second
        time.sleep(1.1)

    with open('food_data.json', 'w', encoding='utf-8') as f:
        json.dump(food_list, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully saved {len(food_list)} items to food_data.json")

if __name__ == "__main__":
    build_data()
