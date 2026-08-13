import { loadFixture } from "@/mocks/fixture-loader"
import fixtureSource from "@/mocks/fixture.yaml?raw"

const fixture = loadFixture(fixtureSource)

export const localDefaultUserId = fixture.defaultUserId
export const localFixture = fixture.state
