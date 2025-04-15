# 设置PostgreSQL环境变量
$env:PATH += ";C:\Program Files\PostgreSQL\17\bin"
$env:PGPASSWORD = "6npns5PuooEPzSCg"

# 验证psql是否可用
try {
    $psqlVersion = psql --version
    Write-Host "PostgreSQL已成功配置: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "警告: PostgreSQL未正确配置，请检查安装路径" -ForegroundColor Red
    Write-Host "错误信息: $_" -ForegroundColor Red
    Exit 1
}

# 启动开发服务器
Write-Host "正在启动开发服务器..." -ForegroundColor Cyan
npm run dev 