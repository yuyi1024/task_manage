from django.contrib import admin
from .models import Project, Module, Task, TaskImage


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'created_at', 'created_by']
    inlines = [ModuleInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'order']
    list_filter = ['project']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'module', 'status', 'priority', 'assign', 'pm', 'end_date']
    list_filter = ['status', 'priority', 'project', 'assign', 'pm']
    search_fields = ['title', 'notes']
    raw_id_fields = []
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'last_modified_by']


@admin.register(TaskImage)
class TaskImageAdmin(admin.ModelAdmin):
    list_display = ['task', 'uploaded_at', 'uploaded_by']
