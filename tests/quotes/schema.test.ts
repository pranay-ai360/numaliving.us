import { describe, expect, it } from "vitest";
import { PROJECT_TYPE_OPTIONS, QUOTE_REQUEST_FIELDS, ROLE_OPTIONS, TIMELINE_OPTIONS } from "../../assets/js/quotes/fields.js";
import { makeRequest, MINIMAL_REQUEST, withoutField } from "./fixtures";
import { parseQuoteRequest, type QuoteRequest } from "../../assets/js/quotes/schema.js";

/** Message of the first problem Zod reports, or undefined when the input is valid. */
function firstProblem(input: unknown): string | undefined {
  const result = parseQuoteRequest(input);
  return result.success ? undefined : result.issue.message;
}

function parsed(input: unknown): QuoteRequest {
  const result = parseQuoteRequest(input);
  if (!result.success) throw new Error(result.issue.message);
  return result.data;
}

describe("quoteRequestSchema", () => {
  it("gives back exactly the fields the field list names, in the same order", () => {
    // Arrange / Act
    const output = parsed(makeRequest({ company: "Lovelace Interiors", phone: "+1 512 555 0100" }));

    // Assert
    expect(Object.keys(output)).toEqual([...QUOTE_REQUEST_FIELDS]);
  });

  describe("a valid request", () => {
    it("accepts a request that has only the required fields", () => {
      // Arrange
      const input = makeRequest();

      // Act
      const result = parseQuoteRequest(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(MINIMAL_REQUEST);
    });

    it("accepts a request with every optional field filled in", () => {
      // Arrange
      const input = makeRequest({
        company: "Lovelace Interiors",
        phone: "+1 512 555 0100",
      });

      // Act
      const output = parsed(input);

      // Assert
      expect(output).toEqual(input);
    });

    it("trims surrounding whitespace from every text field", () => {
      // Arrange
      const input = {
        name: "  Ada Lovelace  ",
        company: "  Lovelace Interiors ",
        email: "  ada@example.com ",
        phone: " +1 512 555 0100 ",
        role: "Main contractor",
        projectType: "Office",
        location: "  Sydney, Australia ",
        timeline: "Tendering now",
        message: "  Reception desk and millwork.  ",
      };

      // Act
      const output = parsed(input);

      // Assert
      expect(output).toEqual({
        name: "Ada Lovelace",
        company: "Lovelace Interiors",
        email: "ada@example.com",
        phone: "+1 512 555 0100",
        role: "Main contractor",
        projectType: "Office",
        location: "Sydney, Australia",
        timeline: "Tendering now",
        message: "Reception desk and millwork.",
      });
      // The option lists the form shows are the ones the schema accepts.
      expect(ROLE_OPTIONS).toContain(output.role);
      expect(PROJECT_TYPE_OPTIONS).toContain(output.projectType);
      expect(TIMELINE_OPTIONS).toContain(output.timeline);
    });

    it("treats blank optional fields as absent", () => {
      // Arrange
      const input = makeRequest({ company: "", phone: "   " });

      // Act
      const output = parsed(input);

      // Assert
      expect(output.company).toBeUndefined();
      expect(output.phone).toBeUndefined();
    });

    it("drops properties that are not part of a Quote Request", () => {
      // Arrange
      const input = { ...makeRequest(), _honey: "bot", isAdmin: true };

      // Act
      const output = parsed(input);

      // Assert
      expect(output).toEqual(MINIMAL_REQUEST);
    });

    it("does not modify the object it was given", () => {
      // Arrange
      const input = Object.freeze({ ...makeRequest(), name: "  Ada  " });

      // Act
      const output = parsed(input);

      // Assert
      expect(output.name).toBe("Ada");
      expect(input.name).toBe("  Ada  ");
    });
  });

  describe("name", () => {
    it.each([["empty", ""], ["only spaces", "   "]])("rejects a name that is %s", (_label, name) => {
      expect(firstProblem(makeRequest({ name }))).toBe("Please enter your full name.");
    });

    it("rejects a missing name", () => {
      expect(firstProblem(withoutField(makeRequest(), "name"))).toBe("Please enter your full name.");
    });

    it("accepts a name of exactly 120 characters", () => {
      expect(firstProblem(makeRequest({ name: "a".repeat(120) }))).toBeUndefined();
    });

    it("measures the 120 character limit after trimming", () => {
      expect(firstProblem(makeRequest({ name: `  ${"a".repeat(120)}  ` }))).toBeUndefined();
    });

    it("rejects a name of 121 characters", () => {
      expect(firstProblem(makeRequest({ name: "a".repeat(121) }))).toBe(
        "Your name must be 120 characters or fewer.",
      );
    });
  });

  describe("company", () => {
    it("accepts a company of exactly 120 characters", () => {
      expect(firstProblem(makeRequest({ company: "c".repeat(120) }))).toBeUndefined();
    });

    it("rejects a company of 121 characters", () => {
      expect(firstProblem(makeRequest({ company: "c".repeat(121) }))).toBe(
        "Company must be 120 characters or fewer.",
      );
    });
  });

  describe("email", () => {
    it.each(["ada@example.com", "ada.lovelace+quotes@sub.example.co.uk"])("accepts %s", (email) => {
      expect(firstProblem(makeRequest({ email }))).toBeUndefined();
    });

    it.each([["empty", ""], ["without an at sign", "ada.example.com"], ["without a domain suffix", "ada@example"], ["with spaces inside", "ada lovelace@example.com"]])(
      "rejects an email that is %s",
      (_label, email) => {
        expect(firstProblem(makeRequest({ email }))).toBe("Please enter a valid email address.");
      },
    );

    it("rejects a missing email", () => {
      expect(firstProblem(withoutField(makeRequest(), "email"))).toBe("Please enter a valid email address.");
    });

    it("rejects an email longer than 254 characters", () => {
      const email = `${"a".repeat(250)}@example.com`;

      expect(firstProblem(makeRequest({ email }))).toBe("Your email address must be 254 characters or fewer.");
    });
  });

  describe("phone", () => {
    it("accepts a phone number of exactly 40 characters", () => {
      expect(firstProblem(makeRequest({ phone: "1".repeat(40) }))).toBeUndefined();
    });

    it("rejects a phone number of 41 characters", () => {
      expect(firstProblem(makeRequest({ phone: "1".repeat(41) }))).toBe(
        "Phone must be 40 characters or fewer.",
      );
    });
  });

  describe.each([
    ["role", ROLE_OPTIONS, "Please choose your role."],
    ["projectType", PROJECT_TYPE_OPTIONS, "Please choose a project type."],
    ["timeline", TIMELINE_OPTIONS, "Please choose a timeline."],
  ] as const)("%s", (field, options, problem) => {
    it.each(options)("accepts %s", (option) => {
      expect(firstProblem({ ...makeRequest(), [field]: option })).toBeUndefined();
    });

    it.each([["an empty choice", ""], ["a value outside the list", "Plumber"], ["the wrong case", options[0].toUpperCase()]])(
      "rejects %s",
      (_label, value) => {
        expect(firstProblem({ ...makeRequest(), [field]: value })).toBe(problem);
      },
    );

    it("rejects a missing choice", () => {
      expect(firstProblem({ ...makeRequest(), [field]: undefined })).toBe(problem);
    });
  });

  describe("location", () => {
    it("rejects a blank location", () => {
      expect(firstProblem(makeRequest({ location: "  " }))).toBe("Please enter the site location.");
    });

    it("accepts a location of exactly 160 characters", () => {
      expect(firstProblem(makeRequest({ location: "l".repeat(160) }))).toBeUndefined();
    });

    it("rejects a location of 161 characters", () => {
      expect(firstProblem(makeRequest({ location: "l".repeat(161) }))).toBe(
        "The site location must be 160 characters or fewer.",
      );
    });
  });

  describe("message", () => {
    it("rejects a blank message", () => {
      expect(firstProblem(makeRequest({ message: "\n  \n" }))).toBe("Please describe the scope of the project.");
    });

    it("accepts a message of exactly 5000 characters", () => {
      expect(firstProblem(makeRequest({ message: "m".repeat(5000) }))).toBeUndefined();
    });

    it("rejects a message of 5001 characters", () => {
      expect(firstProblem(makeRequest({ message: "m".repeat(5001) }))).toBe(
        "Your notes must be 5000 characters or fewer.",
      );
    });
  });

  describe("problem order", () => {
    it("reports the first problem in the order the form shows the fields", () => {
      // Arrange
      const input = { ...makeRequest(), email: "nope", location: "", name: "" };

      // Act
      const problem = firstProblem(input);

      // Assert
      expect(problem).toBe("Please enter your full name.");
    });
  });
});
