import csv
import re
from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from tasks.models import Project, Module, Task


STATUS_MAP = {
    'done': 'done',
    'unconfirm': 'unconfirm',
    'in progress': 'in_progress',
    'pending': 'pending',
    'not started': 'not_started',
    'pause': 'pause',
}

PRIORITY_MAP = {
    'high': 'high',
    'mediun': 'medium',
    'medium': 'medium',
    'low': 'low',
}


def parse_tw_date(s):
    s = s.strip()
    m = re.match(r'(\d+)年(\d+)月(\d+)日', s)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def parse_dates(date_str):
    date_str = date_str.strip()
    if not date_str:
        return None, None
    if '→' in date_str:
        parts = date_str.split('→')
        return parse_tw_date(parts[0]), parse_tw_date(parts[1])
    # single date = end date only
    return None, parse_tw_date(date_str)


def get_or_create_user(username):
    if not username:
        return None
    username = username.strip()
    if not username:
        return None
    user, _ = User.objects.get_or_create(username=username, defaults={'password': '!'})
    return user


class Command(BaseCommand):
    help = 'Import tasks from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str)

    def handle(self, *args, **options):
        csv_path = options['csv_path']
        created_count = 0

        with open(csv_path, encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            next(reader)  # skip header

            for row in reader:
                if len(row) < 2:
                    continue
                # pad row to 10 columns
                row = (row + [''] * 10)[:10]
                title, project_name, status_raw, assign_raw, support_raw, module_name, priority_raw, estimated, date_range, pm_raw = row

                title = title.strip()
                if not title:
                    continue

                # project
                project = None
                if project_name.strip():
                    project, _ = Project.objects.get_or_create(
                        name=project_name.strip(),
                        defaults={'created_by': None}
                    )

                # module
                module = None
                if module_name.strip() and project:
                    module, _ = Module.objects.get_or_create(
                        project=project,
                        name=module_name.strip()
                    )

                # status
                status = STATUS_MAP.get(status_raw.strip().lower(), 'not_started')

                # priority
                priority = PRIORITY_MAP.get(priority_raw.strip().lower(), 'medium')

                # users — take first if comma-separated
                assign_username = assign_raw.split(',')[0].strip() if assign_raw.strip() else ''
                support_username = support_raw.split(',')[0].strip() if support_raw.strip() else ''

                assign = get_or_create_user(assign_username)
                support = get_or_create_user(support_username)
                pm = get_or_create_user(pm_raw.strip())

                start_date, end_date = parse_dates(date_range)

                Task.objects.create(
                    title=title,
                    project=project,
                    module=module,
                    status=status,
                    priority=priority,
                    assign=assign,
                    support=support,
                    pm=pm,
                    estimated_hours=estimated.strip(),
                    start_date=start_date,
                    end_date=end_date,
                    created_by=None,
                    last_modified_by=None,
                )
                created_count += 1
                self.stdout.write(f'  + {title[:60]}')

        self.stdout.write(self.style.SUCCESS(f'\nDone. Created {created_count} tasks.'))
