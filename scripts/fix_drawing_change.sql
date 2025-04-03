WHEN drawing_change = 'false' THEN '未出图'
WHEN drawing_change IS NULL THEN '未出图'
SET drawing_change = '未出图' 