import os
import smtplib
import uuid
import requests
from email.mime.text import MIMEText
from models import db, ActivityLog

def upload_file_to_supabase(file):
    # Carrega do ambiente ou usa padrão do usuário se disponível
    supabase_url = os.environ.get('SUPABASE_URL', 'https://uzawtegjjnlqwjswzxrw.supabase.co').strip()
    supabase_key = os.environ.get('SUPABASE_KEY', '').strip()
    supabase_bucket = os.environ.get('SUPABASE_BUCKET', 'uploads').strip()
    
    # Se não configurado a chave do API do Supabase, salva localmente (fallback)
    if not supabase_key:
        return save_file_locally(file)
        
    try:
        from werkzeug.utils import secure_filename
        filename = secure_filename(file.filename)
        unique_filename = str(uuid.uuid4())[:8] + "_" + filename
        
        # Tenta criar o bucket caso nao exista (auto-inicializacao)
        try:
            bucket_headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json"
            }
            bucket_data = {
                "id": supabase_bucket,
                "name": supabase_bucket,
                "public": True
            }
            requests.post(f"{supabase_url}/storage/v1/bucket", headers=bucket_headers, json=bucket_data)
        except Exception:
            pass
            
        # Endpoint REST do Supabase Storage
        url = f"{supabase_url}/storage/v1/object/{supabase_bucket}/{unique_filename}"
        
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": file.content_type or "application/octet-stream"
        }
        
        file.seek(0)
        file_content = file.read()
        
        res = requests.post(url, headers=headers, data=file_content)
        if res.status_code == 200:
            # Retorna URL pública do bucket
            return f"{supabase_url}/storage/v1/object/public/{supabase_bucket}/{unique_filename}"
        else:
            print(f"Erro no Supabase Storage: {res.status_code} - {res.text}")
            file.seek(0)
            return save_file_locally(file)
    except Exception as e:
        print(f"Erro ao enviar arquivo para o Supabase: {e}")
        try:
            file.seek(0)
        except Exception:
            pass
        return save_file_locally(file)

def save_file_locally(file):
    from werkzeug.utils import secure_filename
    filename = secure_filename(file.filename)
    unique_filename = str(uuid.uuid4())[:8] + "_" + filename
    upload_folder = os.path.join('SISCPTI', 'static', 'img', 'uploads')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    save_path = os.path.join(upload_folder, unique_filename)
    file.save(save_path)
    return "img/uploads/" + unique_filename

def enviar_email(destinatario, assunto, corpo):
    mail_server = os.environ.get('MAIL_SERVER', '').strip()
    mail_user = os.environ.get('MAIL_USER', '').strip()
    mail_pass = os.environ.get('MAIL_PASS', '').strip()
    try:
        mail_port = int(os.environ.get('MAIL_PORT', '587').strip())
    except Exception:
        mail_port = 587
        
    if not mail_server or not mail_user:
        return False
    try:
        msg = MIMEText(corpo, 'html', 'utf-8')
        msg['Subject'] = assunto
        msg['From'] = mail_user
        msg['To'] = destinatario
        
        if mail_port == 465:
            with smtplib.SMTP_SSL(mail_server, 465) as srv:
                srv.login(mail_user, mail_pass)
                srv.sendmail(mail_user, [destinatario], msg.as_string())
        else:
            with smtplib.SMTP(mail_server, mail_port) as srv:
                srv.starttls()
                srv.login(mail_user, mail_pass)
                srv.sendmail(mail_user, [destinatario], msg.as_string())
        return True
    except Exception as e:
        print(f"Erro ao enviar email: {e}")
        return False

def log_atividade(username, acao, detalhes=None):
    try:
        log = ActivityLog(username=username, acao=acao, detalhes=detalhes)
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
