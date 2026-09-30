# SIMULASI — 3D Twin Instrument (ICS Cademy)

Simulasi 3D interaktif (Three.js r128) yang berjalan langsung di browser. Buka `INDEX_3D_TWIN.html`
(atau salah satu halaman di bawah) — tidak perlu server atau build.

| File | Isi |
|---|---|
| `INDEX_3D_TWIN.html` | Halaman indeks semua twin |
| `HYGIENIC_CIP_3D_TWIN.html` | Instrument **hygienic** (food/farmasi) + proses **CIP**; instrument non-hygienic meninggalkan residu dan mencemari Batch B |
| `HAZARDOUS_AREA_3D_TWIN.html` | Instrument **area berbahaya** (Ex): Ex-rated yang sesuai gagal dengan aman, non-Ex memicu kebakaran hebat |
| `SIL_HIPPS_3D_TWIN.html` | Instrument **safety SIL** & **HIPPS 2oo3** (voting, PFD/SIL, waktu respons, kegagalan sensor/valve) |
| `twin_common.css`, `twin_core.js` | Gaya HUD dan inti Three.js bersama (scene, label, X-ray, aliran, grafik, efek api/ledakan) |
| `twin_hygienic.js`, `twin_hazardous.js`, `twin_hipps.js` | Logika & model tiap simulasi |
| `LEVEL_3D_TWIN.html` | Twin level yang sudah ada (butuh file pendukungnya sendiri di folder yang sama) |

## Model singkat

- **Hygienic/CIP** — residu tiap titik meluruh `dR/dt = -k(langkah, T, konsentrasi, kecepatan) · X · R`, dengan `X` = aksesibilitas aliran CIP
  (flush ≈ 0,9 · celah/dead-leg ≈ 0,35 · ulir/dead-leg panjang ≈ 0,03). Mikroba tumbuh saat jeda, lalu terlepas ke Batch B.
- **Hazardous** — awan gas = puff Gaussian (angin, berat jenis gas). Penyalaan hanya bila instrument menjadi sumber nyala **dan**
  konsentrasi di instrument berada di antara LEL–UEL. Ex db: aman bila kelompok gas (MESG) sesuai; Ex ia: energi < MIE.
- **HIPPS/SIL** — `dP/dt = k_in·PCV·XV·(P_hulu−P_hilir) − k_out·(P−20) − PSV`; PFDavg sensor/valve dengan persamaan sederhana IEC 61508-6 (termasuk β),
  batas arsitektur IEC 61508-2 Route 1H (HFT, SFF).

> Semua angka adalah **ilustrasi bahan ajar**, bukan untuk desain, validasi CIP, klasifikasi area, atau perhitungan SIL nyata.
