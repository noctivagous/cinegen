export class Orchestrator {
  constructor(projectId) {
    this.projectId = projectId;
  }

  getPendingReviews() {
    return [];
  }

  async approveReviewItem(itemId, notes) {
    return { ok: true, itemId, nextState: 'approved' };
  }

  async rejectReviewItem(itemId, reason) {
    return { ok: true, itemId, nextState: 'rejected' };
  }
}
