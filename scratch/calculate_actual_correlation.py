import pandas as pd
import numpy as np
import os

root_dir = os.getcwd()
solexs_path = os.path.join(root_dir, "SOLEXS_downloads", "data", "processed", "horizons", "forecast_5min.csv")
hel1os_path = os.path.join(root_dir, "He1os_script", "features", "hel1os_flares", "HEL1OS_TIMESERIES.csv")

if not os.path.exists(solexs_path) or not os.path.exists(hel1os_path):
    print("Files not found!")
    exit(1)

# Load data
solexs = pd.read_csv(solexs_path)
hel1os = pd.read_csv(hel1os_path)

# Let's inspect the columns and timestamps
print("SOLEXS columns:", solexs.columns.tolist()[:10])
print("HEL1OS columns:", hel1os.columns.tolist()[:10])

# Parse timestamps
# SOLEXS might have a 'timestamp' or 'time' column
# HEL1OS has a 'timestamp' or similar column
solexs_time_col = [col for col in solexs.columns if 'time' in col.lower()][0]
hel1os_time_col = [col for col in hel1os.columns if 'time' in col.lower()][0]

print(f"SOLEXS time column: {solexs_time_col}, HEL1OS time column: {hel1os_time_col}")

# Let's convert to datetime
solexs['parsed_time'] = pd.to_datetime(solexs[solexs_time_col], utc=True)
hel1os['parsed_time'] = pd.to_datetime(hel1os[hel1os_time_col], utc=True)

print("SOLEXS time range:", solexs['parsed_time'].min(), "to", solexs['parsed_time'].max())
print("HEL1OS time range:", hel1os['parsed_time'].min(), "to", hel1os['parsed_time'].max())

# Let's merge or align them by rolling join / tolerance join, or resample to 1-minute
solexs_clean = solexs[['parsed_time', 'mean']].rename(columns={'mean': 'solexs_flux'})
# Let's see what flux column HEL1OS has.
hel1os_flux_col = [col for col in hel1os.columns if 'flux' in col.lower() or 'count' in col.lower() or 'intensity' in col.lower() or 'rate' in col.lower()][0]
print(f"HEL1OS flux column found: {hel1os_flux_col}")
hel1os_clean = hel1os[['parsed_time', hel1os_flux_col]].rename(columns={hel1os_flux_col: 'hel1os_flux'})

# Merge within 30 seconds tolerance
merged = pd.merge_asof(
    solexs_clean.sort_values('parsed_time'),
    hel1os_clean.sort_values('parsed_time'),
    on='parsed_time',
    direction='nearest',
    tolerance=pd.Timedelta(seconds=60)
)

print("Merged size:", len(merged))
valid_merged = merged.dropna()
print("Valid merged size (no NaNs):", len(valid_merged))

# Let's search for days/events around 2025-02-11 or other periods where there is activity
# Let's look at the correlation during these periods
valid_merged['date'] = valid_merged['parsed_time'].dt.date
print("Available dates in merged dataset:")
date_counts = valid_merged['date'].value_counts().head(20)
print(date_counts)

# Let's compute rolling correlation for each date or look at high flux times
for d in date_counts.index:
    df_date = valid_merged[valid_merged['date'] == d]
    c = df_date['solexs_flux'].corr(df_date['hel1os_flux'])
    print(f"Date {d}: correlation = {c:.4f}, size = {len(df_date)}")
    
    # If correlation is high, let's see why
    # Let's also print the correlation during the top 50 highest flux periods on that date
    if len(df_date) > 10:
        q_solexs = df_date['solexs_flux'].quantile(0.90)
        high_flux = df_date[df_date['solexs_flux'] > q_solexs]
        if len(high_flux) > 5:
            # Let's take a 30-minute window around the peak of the flare
            peak_time = df_date.loc[df_date['solexs_flux'].idxmax(), 'parsed_time']
            window_df = df_date[(df_date['parsed_time'] >= peak_time - pd.Timedelta(minutes=15)) & 
                                (df_date['parsed_time'] <= peak_time + pd.Timedelta(minutes=15))]
            window_corr = window_df['solexs_flux'].corr(window_df['hel1os_flux'])
            print(f"  -> Near Peak {peak_time.strftime('%H:%M:%S')}: correlation = {window_corr:.4f}, size = {len(window_df)}")
