import json
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from .models import Project, Module, Task, TaskImage, TaskComment
from .forms import ProjectForm, ModuleForm, TaskForm


# ─── Helpers ───────────────────────────────────────────────────────────────

def _get_users():
    return User.objects.all().order_by('username')


def _get_filter_context(request):
    return {
        'filter_project': request.GET.get('project', ''),
        'filter_module': request.GET.get('module', ''),
        'filter_status': request.GET.get('status', ''),
        'filter_priority': request.GET.get('priority', ''),
        'filter_assign': request.GET.get('assign', ''),
        'filter_pm': request.GET.get('pm', ''),
        'group_by': request.GET.get('group_by', 'status'),
    }


def _apply_filters(qs, request):
    p = request.GET.get('project')
    m = request.GET.get('module')
    s = request.GET.get('status')
    pr = request.GET.get('priority')
    a = request.GET.get('assign')
    pm = request.GET.get('pm')

    if p:
        qs = qs.filter(project_id=p)
    if m:
        qs = qs.filter(module_id=m)
    if s:
        qs = qs.filter(status=s)
    if pr:
        qs = qs.filter(priority=pr)
    if a:
        qs = qs.filter(assign_id=a)
    if pm:
        qs = qs.filter(pm_id=pm)
    return qs


def _group_tasks(qs, group_by, sort_by='order'):
    GROUP_FIELDS = {
        'status': ('status', Task.STATUS_CHOICES),
        'priority': ('priority', Task.PRIORITY_CHOICES),
        'project': ('project', None),
        'assign': ('assign', None),
        'pm': ('pm', None),
    }

    sort_map = {
        'priority_desc': ['-priority', 'order'],
        'priority_asc': ['priority', 'order'],
        'start_date': ['start_date', 'order'],
        'end_date': ['end_date', 'order'],
        'created_at': ['-created_at'],
        'order': ['order', '-created_at'],
    }
    order_fields = sort_map.get(sort_by, ['order', '-created_at'])

    groups = []
    if group_by == 'status':
        for val, label in Task.STATUS_CHOICES:
            tasks = qs.filter(status=val).order_by(*order_fields)
            groups.append({'key': val, 'label': label, 'tasks': tasks, 'count': tasks.count()})
    elif group_by == 'priority':
        for val, label in Task.PRIORITY_CHOICES:
            tasks = qs.filter(priority=val).order_by(*order_fields)
            groups.append({'key': val, 'label': label, 'tasks': tasks, 'count': tasks.count()})
    elif group_by == 'project':
        for project in Project.objects.all():
            tasks = qs.filter(project=project).order_by(*order_fields)
            groups.append({'key': project.id, 'label': project.name, 'tasks': tasks, 'count': tasks.count()})
        no_proj = qs.filter(project__isnull=True).order_by(*order_fields)
        if no_proj.exists():
            groups.append({'key': 'none', 'label': '無專案', 'tasks': no_proj, 'count': no_proj.count()})
    elif group_by == 'assign':
        for user in _get_users():
            tasks = qs.filter(assign=user).order_by(*order_fields)
            if tasks.exists():
                groups.append({'key': user.id, 'label': user.get_full_name() or user.username, 'tasks': tasks, 'count': tasks.count()})
        unassigned = qs.filter(assign__isnull=True).order_by(*order_fields)
        if unassigned.exists():
            groups.append({'key': 'none', 'label': '未指派', 'tasks': unassigned, 'count': unassigned.count()})
    elif group_by == 'pm':
        for user in _get_users():
            tasks = qs.filter(pm=user).order_by(*order_fields)
            if tasks.exists():
                groups.append({'key': user.id, 'label': user.get_full_name() or user.username, 'tasks': tasks, 'count': tasks.count()})
        no_pm = qs.filter(pm__isnull=True).order_by(*order_fields)
        if no_pm.exists():
            groups.append({'key': 'none', 'label': '無 PM', 'tasks': no_pm, 'count': no_pm.count()})
    else:
        tasks = qs.order_by(*order_fields)
        groups.append({'key': 'all', 'label': '所有任務', 'tasks': tasks, 'count': tasks.count()})

    return groups


# ─── Task List (Main Page) ──────────────────────────────────────────────────

@login_required
def task_list(request):
    qs = Task.objects.select_related('project', 'module', 'assign', 'support', 'pm')
    qs = _apply_filters(qs, request)

    group_by = request.GET.get('group_by', 'status')
    sort_by = request.GET.get('sort_by', 'priority_desc')
    groups = _group_tasks(qs, group_by, sort_by)

    context = {
        **_get_filter_context(request),
        'groups': groups,
        'projects': Project.objects.all(),
        'modules': Module.objects.select_related('project').all(),
        'users': _get_users(),
        'status_choices': Task.STATUS_CHOICES,
        'priority_choices': Task.PRIORITY_CHOICES,
        'sort_by': sort_by,
        'group_by_options': [
            ('status', '狀態'),
            ('priority', '優先度'),
            ('project', '專案'),
            ('assign', 'Assign'),
            ('pm', 'PM'),
        ],
        'sort_options': [
            ('order', '預設'),
            ('priority_desc', '優先度 高→低'),
            ('priority_asc', '優先度 低→高'),
            ('start_date', '開始日期'),
            ('end_date', '結束日期'),
            ('created_at', '建立時間'),
        ],
    }
    return render(request, 'tasks/task_list.html', context)


# ─── Task CRUD ──────────────────────────────────────────────────────────────

@login_required
@require_http_methods(['POST'])
def task_create(request):
    title = request.POST.get('title', '').strip()
    if not title:
        return HttpResponse('<div class="error-toast">任務名稱不能為空</div>', status=400)

    task = Task.objects.create(
        title=title,
        status=request.POST.get('status', 'not_started'),
        priority=request.POST.get('priority', 'medium'),
        created_by=request.user,
        last_modified_by=request.user,
    )

    project_id = request.POST.get('project')
    if project_id:
        task.project_id = int(project_id)
        task.save()

    users = _get_users()
    context = {
        'task': task,
        'users': users,
        'projects': Project.objects.all(),
        'modules': Module.objects.select_related('project').all(),
        'status_choices': Task.STATUS_CHOICES,
        'priority_choices': Task.PRIORITY_CHOICES,
    }
    return render(request, 'tasks/partials/task_row.html', context)


@login_required
@require_http_methods(['POST'])
def task_update(request, pk):
    task = get_object_or_404(Task, pk=pk)

    SIMPLE_FIELDS = ['title', 'status', 'priority', 'estimated_hours', 'start_date', 'end_date', 'notes']
    NULLABLE_FIELDS = ['start_date', 'end_date']
    FK_FIELDS = {'assign': 'assign_id', 'pm': 'pm_id', 'project': 'project_id', 'module': 'module_id', 'support': 'support_id'}

    updated = False
    for field in SIMPLE_FIELDS:
        if field in request.POST:
            val = request.POST.get(field, '').strip()
            setattr(task, field, val if val else None if field in NULLABLE_FIELDS else val)
            updated = True

    for field, id_field in FK_FIELDS.items():
        if field in request.POST:
            val = request.POST.get(field, '').strip()
            setattr(task, id_field, int(val) if val else None)
            updated = True
            # Clear module when project changes
            if field == 'project':
                task.module_id = None

    if updated:
        task.last_modified_by = request.user
        task.save()

    response = HttpResponse(status=200)
    response['HX-Trigger'] = 'taskSaved'
    return response


@login_required
@require_http_methods(['POST'])
def task_update_description(request, pk):
    task = get_object_or_404(Task, pk=pk)
    task.description = request.POST.get('description', '')
    task.last_modified_by = request.user
    task.save()
    return JsonResponse({'status': 'ok'})



@login_required
@require_http_methods(['POST'])
def task_comment_create(request, pk):
    task = get_object_or_404(Task, pk=pk)
    content = request.POST.get('content', '').strip()
    if not content:
        return HttpResponse(status=400)
    comment = TaskComment.objects.create(task=task, user=request.user, content=content)
    return render(request, 'tasks/partials/comment_item.html', {'comment': comment})


@login_required
@require_http_methods(['POST'])
def task_clone(request, pk):
    original = get_object_or_404(Task, pk=pk)
    group_by = request.POST.get('group_by', 'status')

    new_task = Task.objects.create(
        title=f"{original.title}（複製）",
        status=original.status,
        priority=original.priority,
        project=original.project,
        module=original.module,
        assign=original.assign,
        support=original.support,
        pm=original.pm,
        estimated_hours=original.estimated_hours,
        start_date=original.start_date,
        end_date=original.end_date,
        description=original.description,
        notes=original.notes,
        created_by=request.user,
        last_modified_by=request.user,
    )

    group_key_map = {
        'status':   new_task.status,
        'priority': new_task.priority,
        'project':  str(new_task.project_id) if new_task.project_id else 'none',
        'assign':   str(new_task.assign_id)   if new_task.assign_id   else 'none',
        'pm':       str(new_task.pm_id)        if new_task.pm_id       else 'none',
    }
    group_key = group_key_map.get(group_by, new_task.status)

    context = {
        'task': new_task,
        'users': _get_users(),
        'projects': Project.objects.all(),
        'modules': Module.objects.select_related('project').all(),
        'status_choices': Task.STATUS_CHOICES,
        'priority_choices': Task.PRIORITY_CHOICES,
    }
    response = render(request, 'tasks/partials/task_row.html', context)
    response['X-Clone-Group-Key'] = group_key
    return response


@login_required
@require_http_methods(['POST'])
def task_delete(request, pk):
    task = get_object_or_404(Task, pk=pk)
    task.delete()
    response = HttpResponse(status=200)
    response['HX-Trigger'] = 'taskDeleted'
    return response


# ─── Task Detail Panel ──────────────────────────────────────────────────────

@login_required
def task_detail(request, pk):
    task = get_object_or_404(
        Task.objects.select_related('project', 'module', 'assign', 'support', 'pm', 'created_by', 'last_modified_by'),
        pk=pk
    )
    modules = Module.objects.filter(project=task.project) if task.project else Module.objects.none()
    context = {
        'task': task,
        'users': _get_users(),
        'projects': Project.objects.all(),
        'modules': modules,
        'status_choices': Task.STATUS_CHOICES,
        'priority_choices': Task.PRIORITY_CHOICES,
        'comments': task.comments.select_related('user').all(),
    }
    return render(request, 'tasks/partials/detail_panel.html', context)


# ─── Dynamic Module Options ─────────────────────────────────────────────────

@login_required
def module_options(request):
    # Accept both 'project_id' (legacy/inline) and 'project' (modal hx-include)
    project_id = (
        request.GET.get('project_id') or
        request.GET.get('project') or
        request.POST.get('project_id') or
        request.POST.get('project')
    )
    current_module_id = request.GET.get('current_module_id', '')
    modules = Module.objects.filter(project_id=project_id) if project_id else Module.objects.none()
    context = {'modules': modules, 'current_module_id': current_module_id}
    return render(request, 'tasks/partials/module_options.html', context)


# ─── Image Upload ────────────────────────────────────────────────────────────

@login_required
@require_http_methods(['POST'])
def image_upload(request):
    task_id = request.POST.get('task_id')
    image_file = request.FILES.get('image')
    if not image_file:
        return JsonResponse({'error': 'No image provided'}, status=400)

    img = TaskImage.objects.create(
        task_id=task_id if task_id else None,
        image=image_file,
        uploaded_by=request.user,
    )
    return JsonResponse({'url': img.image.url})


# ─── Projects ───────────────────────────────────────────────────────────────

@login_required
def project_list(request):
    projects = Project.objects.prefetch_related('modules', 'tasks').all()
    context = {
        'projects': projects,
        'form': ProjectForm(),
    }
    return render(request, 'tasks/project_list.html', context)


@login_required
@require_http_methods(['POST'])
def project_create(request):
    form = ProjectForm(request.POST)
    if form.is_valid():
        project = form.save(commit=False)
        project.created_by = request.user
        project.save()
        if request.headers.get('HX-Request'):
            projects = Project.objects.prefetch_related('modules').all()
            return render(request, 'tasks/partials/project_list_items.html', {'projects': projects})
    return redirect('tasks:project_list')


@login_required
@require_http_methods(['POST'])
def project_update(request, pk):
    project = get_object_or_404(Project, pk=pk)
    form = ProjectForm(request.POST, instance=project)
    if form.is_valid():
        form.save()
    if request.headers.get('HX-Request'):
        return render(request, 'tasks/partials/project_card.html', {'project': project})
    return redirect('tasks:project_list')


@login_required
@require_http_methods(['POST'])
def project_delete(request, pk):
    project = get_object_or_404(Project, pk=pk)
    project.delete()
    response = HttpResponse(status=200)
    response['HX-Trigger'] = 'projectDeleted'
    return response


@login_required
@require_http_methods(['POST'])
def module_create(request):
    form = ModuleForm(request.POST)
    if form.is_valid():
        form.save()
    return redirect('tasks:project_list')


@login_required
@require_http_methods(['POST'])
def module_delete(request, pk):
    module = get_object_or_404(Module, pk=pk)
    module.delete()
    return HttpResponse(status=200)


# ─── Users API ───────────────────────────────────────────────────────────────

@login_required
def users_api(request):
    users = [
        {'id': u.id, 'name': u.get_full_name() or u.username}
        for u in _get_users()
    ]
    return JsonResponse({'users': users})
