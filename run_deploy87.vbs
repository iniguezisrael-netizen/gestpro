Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c cd /d C:\Users\israe\Downloads\firebase-deploy && firebase deploy --only hosting,functions > C:\Users\israe\Downloads\firebase-deploy\deploy87-result.txt 2>&1", 0, True
