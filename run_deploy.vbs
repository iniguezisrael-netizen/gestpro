Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c ""cd /d C:\Users\israe\Downloads\firebase-deploy && firebase deploy --only hosting > C:\Users\israe\Downloads\firebase-deploy\deploy-result.txt 2>&1"""
