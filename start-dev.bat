@echo off
echo 正在配置PostgreSQL环境...
set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin
set PGPASSWORD=6npns5PuooEPzSCg

echo 验证PostgreSQL是否可用...
psql --version
if %ERRORLEVEL% neq 0 (
    echo 警告: PostgreSQL未正确配置，请检查安装路径
    exit /b 1
)

echo 正在启动开发服务器...
npm run dev 