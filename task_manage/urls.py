from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

# Build path prefix once at startup (e.g. 'task_manage/' or '' for root deployment)
_p = settings.URL_PREFIX.strip('/') + '/' if settings.URL_PREFIX else ''
_tasks_root = f'/{_p}tasks/'

urlpatterns = [
    path(f'{_p}admin/', admin.site.urls),
    path(f'{_p}accounts/', include('django.contrib.auth.urls')),
    path(f'{_p}tasks/', include('tasks.urls')),
    path(f'{_p}', RedirectView.as_view(url=_tasks_root, permanent=False)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
