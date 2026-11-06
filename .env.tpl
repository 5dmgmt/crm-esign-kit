# crm-esign-kit の環境変数のひな形（1Password を使う場合）
#
# 1Password を使う場合: op inject -i .env.tpl -o .env.local
# 使わない場合: .env.example を .env.local に写し、値をご自身のエディタで入れる
#
# ここに書くのは値ではなく、1Password の置き場所（vault・item・field の参照）だけ。
# vault・item・field の名前は例。ご自身の 1Password に合わせて直す。
# 参照先の item が無いと op inject は止まる。使わないメール方式
# （MAIL_TRANSPORT で選ばない方の SMTP か Resend）の行は、消してから実行する。
# 念のため、コメントの中には参照そのものを書かない（op inject が読むおそれがあるため）。

# Supabase
NEXT_PUBLIC_SUPABASE_URL=op://workshop/crm-supabase/url
SUPABASE_SERVICE_ROLE_KEY=op://workshop/crm-supabase/service-role-key

# ログイン（NEXTAUTH_URL と SITE_URL は同じ値。ローカルは http://localhost:3000）
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=op://workshop/crm-nextauth/secret
GOOGLE_CLIENT_ID=op://workshop/crm-google-oauth/client-id
GOOGLE_CLIENT_SECRET=op://workshop/crm-google-oauth/client-secret

# 管理者（自分の Google アカウントのメールに書き換える。複数はカンマ区切り）
ADMIN_EMAILS=owner@example.com

# サイトの URL
SITE_URL=http://localhost:3000

# メール（MAIL_TRANSPORT は smtp・resend・none のどれか）
MAIL_TRANSPORT=resend

# メール: SMTP を使う場合
SMTP_HOST=op://workshop/crm-smtp/host
SMTP_PORT=op://workshop/crm-smtp/port
SMTP_USER=op://workshop/crm-smtp/user
SMTP_PASS=op://workshop/crm-smtp/password
SMTP_FROM=op://workshop/crm-smtp/from-email

# メール: Resend を使う場合
RESEND_API_KEY=op://workshop/resend/credential
MAIL_FROM=op://workshop/resend/from-email
