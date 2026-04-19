from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0003_taskcomment'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='icon',
            field=models.CharField(blank=True, default='folder', max_length=50),
        ),
    ]
