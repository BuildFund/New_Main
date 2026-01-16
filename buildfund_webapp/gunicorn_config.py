"""Gunicorn configuration for BuildFund production deployment."""
import multiprocessing
import os

# Server socket
bind = "127.0.0.1:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
accesslog = "/var/log/buildfund/gunicorn_access.log"
errorlog = "/var/log/buildfund/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "buildfund"

# Server mechanics
daemon = False
pidfile = "/var/run/buildfund/gunicorn.pid"
umask = 0
user = "www-data"
group = "www-data"
tmp_upload_dir = None

# SSL (if using Gunicorn for SSL termination)
# keyfile = None
# certfile = None

# Performance
max_requests = 1000
max_requests_jitter = 50
preload_app = True

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("BuildFund server is ready. Spawning workers")

def worker_int(worker):
    """Called when a worker receives INT or QUIT signal."""
    worker.log.info("worker received INT or QUIT signal")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info("Worker initialized (pid: %s)", worker.pid)

def worker_abort(worker):
    """Called when a worker times out."""
    worker.log.warning("Worker timeout (pid: %s)", worker.pid)
