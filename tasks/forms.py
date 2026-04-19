from django import forms
from django.contrib.auth.models import User
from .models import Project, Module, Task


class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name', 'description', 'color', 'icon']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input', 'placeholder': '專案名稱'}),
            'description': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': '專案描述（選填）'}),
            'color': forms.TextInput(attrs={'type': 'color', 'class': 'color-picker'}),
        }


class ModuleForm(forms.ModelForm):
    class Meta:
        model = Module
        fields = ['name', 'project']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-input', 'placeholder': '模組名稱'}),
            'project': forms.Select(attrs={'class': 'form-select'}),
        }


class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = [
            'title', 'project', 'module', 'status', 'priority',
            'assign', 'support', 'pm', 'estimated_hours',
            'start_date', 'end_date', 'description', 'notes',
        ]
        widgets = {
            'title': forms.Textarea(attrs={'class': 'form-input', 'rows': 2}),
            'project': forms.Select(attrs={'class': 'form-select'}),
            'module': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'priority': forms.Select(attrs={'class': 'form-select'}),
            'assign': forms.Select(attrs={'class': 'form-select'}),
            'support': forms.SelectMultiple(attrs={'class': 'form-select'}),
            'pm': forms.Select(attrs={'class': 'form-select'}),
            'estimated_hours': forms.NumberInput(attrs={'class': 'form-input', 'step': '0.5'}),
            'start_date': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'end_date': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'notes': forms.Textarea(attrs={'class': 'form-input', 'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        users = User.objects.all().order_by('username')
        empty = [('', '---------')]
        user_choices = [(u.id, u.get_full_name() or u.username) for u in users]

        self.fields['assign'].queryset = users
        self.fields['support'].queryset = users
        self.fields['pm'].queryset = users
        self.fields['assign'].empty_label = '-'
        self.fields['pm'].empty_label = '-'

        # Limit module choices to project if project is set
        if self.instance.pk and self.instance.project_id:
            self.fields['module'].queryset = Module.objects.filter(project=self.instance.project)
        else:
            self.fields['module'].queryset = Module.objects.none()
        self.fields['module'].empty_label = '-'
