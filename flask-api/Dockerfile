# Use uma imagem base do Python
FROM python:3.9-slim

# Defina o diretório de trabalho no contêiner
WORKDIR /app

# Copie os arquivos de aplicação para o diretório de trabalho
COPY requirements.txt /app
COPY *.py /app
COPY data.json /app

# Instale as dependências do Python
RUN pip install -r requirements.txt

# Exponha a porta em que o aplicativo Flask estará escutando (por padrão 5000)
EXPOSE 8000

# Comando para iniciar o servidor Gunicorn
CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8000"]
