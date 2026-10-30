Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /k cd /d C:\Users\israe\Downloads\firebase-deploy && firebase deploy --only hosting", 1, False
