from django.urls import path
from . import views

app_name = 'tasks'

urlpatterns = [
    # Main task list
    path('', views.task_list, name='task_list'),

    # Task CRUD
    path('create/', views.task_create, name='task_create'),
    path('<int:pk>/update/', views.task_update, name='task_update'),
    path('<int:pk>/update-description/', views.task_update_description, name='task_update_description'),
    path('<int:pk>/clone/', views.task_clone, name='task_clone'),
    path('<int:pk>/delete/', views.task_delete, name='task_delete'),
    path('<int:pk>/comment/', views.task_comment_create, name='task_comment_create'),

    # Detail panel (slide-over)
    path('<int:pk>/detail/', views.task_detail, name='task_detail'),

    # Dynamic module options
    path('module-options/', views.module_options, name='module_options'),

    # Image upload
    path('image-upload/', views.image_upload, name='image_upload'),

    # Projects
    path('projects/', views.project_list, name='project_list'),
    path('projects/create/', views.project_create, name='project_create'),
    path('projects/<int:pk>/update/', views.project_update, name='project_update'),
    path('projects/<int:pk>/delete/', views.project_delete, name='project_delete'),

    # Modules
    path('modules/create/', views.module_create, name='module_create'),
    path('modules/<int:pk>/delete/', views.module_delete, name='module_delete'),

    # API
    path('api/users/', views.users_api, name='users_api'),
]
