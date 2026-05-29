from django.db import models
from django.contrib.auth.models import User


class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#6366f1')
    icon = models.CharField(max_length=50, default='folder', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_projects'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Module(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='modules')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class Task(models.Model):
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('unconfirm', 'Unconfirm'),
        ('pending', 'Pending'),
        ('pause', 'Pause'),
        ('done', 'Done'),
    ]
    PRIORITY_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    title = models.TextField()
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks'
    )
    module = models.ForeignKey(
        Module, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    assign = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks'
    )
    support = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tasks'
    )
    pm = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pm_tasks'
    )
    estimated_hours = models.CharField(max_length=50, blank=True, default='')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_tasks'
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='modified_tasks'
    )
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title[:80]

    def get_status_color(self):
        colors = {
            'pending': '#94a3b8',
            'not_started': '#7dd3fc',
            'in_progress': '#3b82f6',
            'unconfirm': '#f97316',
            'done': '#22c55e',
            'pause': '#a8896a',
        }
        return colors.get(self.status, '#94a3b8')

    def get_priority_color(self):
        colors = {
            'high': '#ef4444',
            'medium': '#f59e0b',
            'low': '#22c55e',
        }
        return colors.get(self.priority, '#94a3b8')


class TaskComment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='task_comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user} on task {self.task_id}"


class TaskImage(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name='images')
    image = models.ImageField(upload_to='task_images/%Y/%m/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"Image for task {self.task_id}"


class ProjectNote(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_notes')
    title = models.CharField(max_length=255)
    summary = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True)
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_notes'
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='modified_notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-updated_at']

    def __str__(self):
        return self.title
