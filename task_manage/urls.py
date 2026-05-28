from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

p = settings.URL_PREFIX.strip('/') + '/' if settings.URL_PREFIX else ''
tasks_root = f'/{p}tasks/'

urlpatterns = [
    path(f'{p}admin/', admin.site.urls),
    path(f'{p}accounts/', include('django.contrib.auth.urls')),
    path(f'{p}tasks/', include('tasks.urls')),
    path(f'{p}', RedirectView.as_view(url=tasks_root, permanent=False)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
