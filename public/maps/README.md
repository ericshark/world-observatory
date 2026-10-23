# Geographic source

The bundled `app/data/countries-50m.json` is derived from Natural Earth v5.1.2,
1:50m Admin 0 Countries, downloaded from the tagged upstream release:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
Only country identifiers, display names, label coordinates, and full geometry are
retained. ISO_A2_EH is used, with Kosovo mapped to XK and Somaliland to SO to
match the statistical catalogue. D3 spherical winding is normalized on import.
Boundaries are illustrative and do not express a position on sovereignty.
Northern Cyprus shares CY for statistical selection; the unassigned Siachen
Glacier polygon uses ZZ and remains unavailable in the statistical surface.
