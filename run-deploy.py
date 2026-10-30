#!/usr/bin/env python3
"""
Ejecuta firebase deploy y responde 'y' automaticamente a cualquier prompt
de eliminacion de funciones.
"""
import pexpect
import sys
import os

os.chdir(r'C:\Users\israe\Downloads\firebase-deploy')

child = pexpect.spawn(
    'firebase',
    ['deploy', '--only', 'functions,hosting', '--project', 'campers-la-cuesta-84ade'],
    encoding='utf-8',
    timeout=300,
    cwd=r'C:\Users\israe\Downloads\firebase-deploy'
)

child.logfile = open('deploy-log.txt', 'w')

try:
    while True:
        idx = child.expect([
            r'\(y/N\)',          # prompt de eliminacion
            pexpect.EOF,
            pexpect.TIMEOUT,
        ], timeout=300)

        if idx == 0:
            # Responder "y" para continuar con eliminacion
            print('[auto] Respondiendo y al prompt...', flush=True)
            child.sendline('y')
        elif idx == 1:
            print('[auto] Deploy terminado (EOF)', flush=True)
            break
        elif idx == 2:
            print('[auto] Timeout esperando output', flush=True)
            break
except Exception as e:
    print(f'[auto] Error: {e}', flush=True)

child.logfile.close()
print('[auto] Listo. Revisa deploy-log.txt')
