# Managing jobs and homepage banners

Job vacancies and homepage banners are simple text files in this `content` folder. Edit them on github.com. When you save (commit) a change, Vercel rebuilds the website automatically. The change is live in about a minute or two.

You need a GitHub account with write access to the repository.

## Job vacancies — `content/careers/`

### Add a vacancy

1. Open the `content/careers` folder on GitHub.
2. Open `_driver-template.md` or `_mechanic-template.md` and copy all of its text.
3. Go back to `content/careers` and choose **Add file → Create new file**.
4. Name the file after the job, using lowercase letters, numbers and hyphens only, ending in `.md`. For example: `bus-driver-casual.md`. The name becomes the job's web address: `/careers/bus-driver-casual`.
5. Paste the template, then fill it in:
   - `title`: the job title shown on the website.
   - `role`: `Driver` or `Mechanic`. This chooses the extra questions on the application form: licence, Driver Authority and Working With Children Check for drivers; qualifications for mechanics.
   - `employmentType`: one of `Full-time`, `Part-time`, `Casual`, `Contract`, `Apprenticeship`.
   - `location`, `summary` and, optionally, `salary`.
   - `posted`: the date the job appears, in YYYY-MM-DD format.
   - `closes`: the closing date. The job disappears automatically after this date. Leave it empty to keep the job open.
   - `published: true` to show the job.
6. Below the second `---` line, write the description in plain text:
   - `## Heading` makes a heading.
   - `- item` makes a bullet point.
   - `**bold**` makes bold text.
   - `[link text](https://example.com)` makes a link.
7. Choose **Commit changes**.

### Update or remove a vacancy

- **Update:** open the job's file, click the pencil (Edit) icon, change it, and commit.
- **Hide temporarily:** change `published: true` to `published: false`.
- **Remove for good:** open the file, choose **⋯ → Delete file**, and commit.

When no vacancies are published and open, the Careers page shows: *"There are currently no vacancies available. Please check back later for future opportunities."*

### Applications

Each **Apply now** form sends the applicant's details and CV (PDF or Word, up to 4 MB) by email to **admin@punchbowlbus.com.au**. Reply to the email to contact the applicant. The website doesn't store applications.

Until the email service is set up (see the main README), the Apply section asks applicants to email their CV to that address instead.

## Homepage banners — `content/promotions/`

The homepage hero is a slideshow. The company introduction is always the first slide, followed by each published banner.

There are two kinds of banner, set with the `style` line:

- **`style: photo`**: a wide photograph that fills the banner behind the headline. Use a landscape photo of at least **1600 × 900 pixels** (1920 × 1080 or larger is best). Keep important text out of the photo, because it's cropped on different screens; put the words in the banner file instead.
- **`style: poster`**: a designed advertisement, such as a "We're hiring" flyer, shown **in full and never cropped** beside the headline and button. Use a picture of at least **900 × 900 pixels**. Portrait or square posters work best.

Pictures smaller than these minimums are rejected, so blurry banners can't go live.

1. Upload the picture to `public/images/promotions/` (**Add file → Upload files**). Use JPG, PNG or WEBP, ideally under about 800 KB.
2. In `content/promotions`, copy `_template.md` into a new file such as `summer-offer.md`.
3. Fill in:
   - `style`: `photo` or `poster`.
   - `title`, plus optional `eyebrow` (small label) and `text`.
   - `image`: for example `/images/promotions/summer.jpg`.
   - `imageAlt`: a description of the picture for people who can't see it.
   - Optional button: `buttonLabel` with `buttonLink`, such as `/request-a-quote` or a full `https://` address.
   - Optional `start` and `end` dates (YYYY-MM-DD). The banner shows only between them.
   - `order`: lower numbers appear first.
   - `published: true`.
4. Commit. To remove a banner, set `published: false` or delete the file.

Pictures from the Facebook page can be used. Download them from Facebook and upload them as above.

**Example:** `apprentice-diesel-mechanic.md` is a poster banner for the hiring advert. It links to the matching vacancy and has `end: 2026-12-10`, so it disappears after applications close.

**Job adverts:** a vacancy file can also show its advert on the job page. Add `poster: /images/promotions/your-poster.jpg` and a `posterAlt` description to the job file.

## If something goes wrong

If a file has a mistake, such as a missing title or a date that isn't YYYY-MM-DD, Vercel stops that update. The website keeps showing the previous version, so nothing breaks for visitors. Vercel's deployment log names the file and the problem. Fix the file and commit again.
