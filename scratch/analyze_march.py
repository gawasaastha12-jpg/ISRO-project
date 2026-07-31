import pandas as pd
import numpy as np

# Load processed dataset
df = pd.read_csv('SOLEXS_downloads/data/processed/dataset_research_v5.csv')
march = df[df['source_file'].str.contains('20250325', na=False)].copy()
march = march.reset_index(drop=True)
march['window_idx'] = range(len(march))
march['utc_minutes'] = march['window_idx'] * 5

# Show all C-like windows
c_windows = march[march['label'] >= 2].copy()
print(f'C-like windows: {len(c_windows)}')
print()
print('All elevated windows:')
print(c_windows[['window_idx','utc_minutes','label',
                  'max_prominence','spectral_entropy',
                  'max_gradient']].to_string())
print()

# What time do they cluster?
print(f'C-like window times:')
for _, row in c_windows.iterrows():
    h = int(row['utc_minutes']//60)
    m = int(row['utc_minutes']%60)
    print(f'  {h:02d}:{m:02d} UTC  prominence={row["max_prominence"]:.1f}  entropy={row["spectral_entropy"]:.4f}')

# Find the peak C window
if len(c_windows) > 0:
    peak = c_windows.loc[c_windows['max_prominence'].idxmax()]
    peak_h = int(peak['utc_minutes']//60)
    peak_m = int(peak['utc_minutes']%60)
    print(f'\nPeak C window: {peak_h:02d}:{peak_m:02d} UTC  prominence={peak["max_prominence"]:.1f}')
    print()

    # Show 6 windows before the first C window
    first_c_idx = c_windows['window_idx'].min()
    pre_c = march[march['window_idx'].between(first_c_idx-6, first_c_idx-1)]
    print('6 windows immediately before first C-like window:')
    print(pre_c[['window_idx','utc_minutes','label',
                 'max_prominence','spectral_entropy','max_gradient']].to_string())
else:
    print("\nNo C-like windows found.")
