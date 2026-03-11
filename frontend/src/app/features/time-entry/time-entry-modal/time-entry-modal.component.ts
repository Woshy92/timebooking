import { Component, inject, computed } from '@angular/core';
import { UiStore } from '../../../state/ui.store';
import { TimeEntryStore } from '../../../state/time-entry.store';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { TimeEntryFormComponent } from '../time-entry-form/time-entry-form.component';
import { CreateTimeEntryDTO, UpdateTimeEntryDTO } from '../../../domain/models/time-entry.model';

@Component({
  selector: 'app-time-entry-modal',
  standalone: true,
  imports: [ModalComponent, TimeEntryFormComponent],
  template: `
    @if (ui.isEntryModalOpen()) {
      <app-modal [title]="modalTitle()" (closed)="ui.closeEntryModal()">
        <app-time-entry-form
          [entry]="selectedEntry()"
          (saved)="onSave($event)"
          (cancelled)="ui.closeEntryModal()"
          (deleteClicked)="onDelete()"
        />
      </app-modal>
    }
  `,
})
export class TimeEntryModalComponent {
  protected readonly ui = inject(UiStore);
  private readonly timeEntryStore = inject(TimeEntryStore);

  readonly selectedEntry = computed(() => {
    const id = this.ui.selectedEntryId();
    if (!id) return null;
    return this.timeEntryStore.entries().find(e => e.id === id) ?? null;
  });

  readonly modalTitle = computed(() =>
    this.selectedEntry() ? 'Zeiteintrag bearbeiten' : 'Neuer Zeiteintrag'
  );

  onSave(event: { dto: CreateTimeEntryDTO } | { id: string; changes: UpdateTimeEntryDTO }) {
    if ('dto' in event) {
      this.timeEntryStore.addEntry(event.dto);
    } else {
      this.timeEntryStore.updateEntry(event.id, event.changes);
    }
    this.ui.closeEntryModal();
  }

  onDelete() {
    const id = this.ui.selectedEntryId();
    if (id) {
      this.timeEntryStore.removeEntry(id);
      this.ui.closeEntryModal();
    }
  }
}
