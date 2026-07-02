@set "PATH=C:\Program Files\nodejs;%PATH%"
@echo Configurando banco: generate, schema, seed...
call "C:\Program Files\nodejs\npm.cmd" run prisma:generate
call "C:\Program Files\nodejs\npx.cmd" prisma db push
call "C:\Program Files\nodejs\npm.cmd" run prisma:seed
@echo.
@echo Pronto. Use o e-mail e a senha do master (MASTER_INITIAL_EMAIL e MASTER_INITIAL_PASSWORD do .env) para fazer login.
@pause
