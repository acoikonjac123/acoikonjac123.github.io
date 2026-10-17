@echo off
:: 设置 UTF-8 编码，防止中文乱码
chcp 65001 >nul
title 3D Rubik Cube Starter

echo ========================================
echo        3D Rubik Cube Starter
echo ========================================
echo.

:: 1. 检查 Python 是否已安装并配置到环境变量
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python！
    echo 请安装 Python 并确保已勾选 "Add Python to PATH"。
    pause
    exit /b
)

:: 2. 获取并显示 Python 的真实路径 (修复你原有的逻辑)
for /f "delims=" %%i in ('where python') do (
    set "PYPATH=%%i"
    goto :found_path
)
:found_path
echo [信息] 检测到 Python 环境: %PYPATH%
echo.

:: 3. 提示信息
echo [提示] 正在启动本地 HTTP 服务器 (端口: 8000)...
echo [提示] 浏览器将自动打开。若未自动打开，请手动访问: http://localhost:8000
echo [提示] 保持此窗口开启，按 Ctrl+C 或关闭窗口可停止服务器。
echo ========================================
echo.

:: 4. 延迟 2 秒后自动用默认浏览器打开网页
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"

:: 5. 启动 Python 内置的 HTTP 服务器 (支持 ES Modules)
python -m http.server 8000

:: 6. 如果服务器意外崩溃，暂停窗口以便查看报错信息
pause