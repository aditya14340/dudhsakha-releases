
def parse_milk_data(raw_data: str) -> dict | None:
    """
    Parses the raw serial data string into a structured dictionary.
    Expected format: (06600870278212930000035305958)
    """
    try:
        clean_data = raw_data.replace('(', '').replace(')', '').strip()
        
        if len(clean_data) < 28:
            return None

        # Extract fields based on fixed positions
        fat_raw = float(clean_data[0:4]) / 100
        snf_raw = float(clean_data[4:8]) / 100
        density = float(clean_data[8:12]) / 100
        added_water = float(clean_data[12:16]) / 100
        # 16-20 might be freezing point or similar unused field
        protein = float(clean_data[20:24]) / 100
        temperature = float(clean_data[24:28]) / 100 # Assuming this based on "0595" -> 5.95

        # Round fat and snf to 1 decimal place (e.g. 7.60 -> 7.6, 8.20 -> 8.2)
        fat = round(fat_raw, 1)
        snf = round(snf_raw, 1)

        return {
            "fat": fat,
            "snf": snf,
            "density": density,
            "added_water": added_water,
            "protein": protein,
            "temperature": temperature,
            "raw": raw_data
        }
    except Exception as e:
        print(f"Error parsing data: {e}")
        return None

if __name__ == "__main__":
    # Test case
    test_str = "(06600870278212930000035305958)"
    result = parse_milk_data(test_str)
    print(f"Test Result: {result}")
