Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c cd /d C:\Users\israe\Downloads\firebase-deploy && firebase deploy --only hosting > C:\Users\israe\Downloads\firebase-deploy\deploy103-result.txt 2>&1", 0, True
