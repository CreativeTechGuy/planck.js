import * as planck from './dist/planck'

const world = planck.World()

const body = world.createBody()
const shape = planck.Circle(3)

body.createFixture({
  shape,
})
