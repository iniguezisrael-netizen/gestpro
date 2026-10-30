@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"
firebase deploy --only hosting --project campers-la-cuesta-84ade > deploy-result.txt 2>&1
