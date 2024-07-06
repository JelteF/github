// @ts-check
/** @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */
module.exports = async ({ github, context }) => {
  /**
   * @param {number} days
   */
  function date(days) {
    return new Date(
      new Date().getTime() - (days ?? 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  // Fetch notifications for the current page
  const notifs = await github.paginate("GET /notifications", {
    all: true,
    before: date(1),
    since: date(3),
  });

  // Loop through each notification and its corresponding ID
  for (const notif of notifs) {
    let done = false;

    if (
      // Skip discussions, check suites and releases
      notif.subject.type == "Discussion" ||
      notif.subject.type == "CheckSuite" ||
      notif.subject.type == "Release"
    ) {
      // Mark discussions as done
      done = true;
    } else if (
      notif.subject.type == "Issue" ||
      notif.subject.type == "PullRequest"
    ) {
      const latestCommentUrl = notif.subject.latest_comment_url;
      const details = await github.request(`GET ${notif.subject.url}`);
      // Mark as done if the issue/PR is closed
      if (details.data.state === "closed") done = true;
      // If the issue/PR is open, check if the latest comment is from stale-bot
      else if (latestCommentUrl) {
        // Fetch the comment details
        const comment = await github.request(`GET ${latestCommentUrl}`);
        done =
          comment.data.user.login === "github-actions[bot]" &&
          /stale/.test(comment.data.body);
      }
    }
    // remove api. and repos/ from the url
    const url = (notif.subject.url ?? notif.url)
      .replace("api.", "")
      .replace("repos/", "");
    if (done) {
      console.log(`❌ ${notif.subject.title}\n  - ${url}`);
      await github.request(`DELETE /notifications/threads/${notif.id}`);
    } else {
      console.log(`✅ ${notif.subject.title}\n  - ${url}`);
    }
  }
};
