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

    # Task row partial (for refresh after panel save)
    path('<int:pk>/row/', views.task_row_partial, name='task_row_partial'),

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

    # Notes overview (all projects)
    path('notes/', views.all_notes_list, name='all_notes_list'),
    path('notes/create/', views.note_create_any, name='note_create_any'),

    # Notes per project
    path('projects/<int:project_pk>/notes/', views.note_list, name='note_list'),
    path('projects/<int:project_pk>/notes/create/', views.note_create, name='note_create'),
    path('notes/<int:pk>/', views.note_detail, name='note_detail'),
    path('notes/<int:pk>/update/', views.note_update, name='note_update'),
    path('notes/<int:pk>/update-content/', views.note_update_content, name='note_update_content'),
    path('notes/<int:pk>/delete/', views.note_delete, name='note_delete'),
    path('notes/<int:pk>/pin/', views.note_pin_toggle, name='note_pin_toggle'),
]
