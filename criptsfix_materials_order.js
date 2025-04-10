[33mcommit cd3cca09142997ad1a18d1cef938cfb220b3bc6d[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m)[m
Author: Your Name <your.email@example.com>
Date:   Thu Apr 10 14:29:37 2025 +0800

    修复采购材料顺序问题，确保'南飞U型80防水压块组合'显示在第9行

A	database/migrations/create_procurement_materials.sql
M	database/types.ts
A	docs/procurement-dashboard-guide.md
M	package-lock.json
M	package.json
A	scripts/apply_procurement_migrations.js
A	scripts/fix_materials_order.js
M	src/pages/roles/ProcurementDashboard.tsx
A	src/services/procurementApi.ts
